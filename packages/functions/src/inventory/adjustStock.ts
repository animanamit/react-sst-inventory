import { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  dynamoDb,
  handleDynamoError,
  createResponse,
  createErrorResponse,
} from "../utils/dynamodb";
import {
  StockAdjustmentSchema,
  InventoryHistorySchema,
  AlertSchema
} from "../utils/types";
import { ulid } from "ulid";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Debug environment information is available if needed
    
    // Check if request has a body
    if (!event.body) {
      return createErrorResponse(400, "Missing request body");
    }

    // Parse request body
    const body = JSON.parse(event.body);

    // Validate DynamoDB table environment variables
    if (!process.env.INVENTORY_TABLE) {
      return createErrorResponse(500, "INVENTORY_TABLE environment variable is not set");
    }
    
    if (!process.env.PRODUCTS_TABLE) {
      return createErrorResponse(500, "PRODUCTS_TABLE environment variable is not set");
    }

    // Validate the adjustment data with zod
    let adjustmentData;
    try {
      adjustmentData = StockAdjustmentSchema.parse(body);
    } catch (validationError) {
      console.error("Validation error:", validationError);
      return createErrorResponse(400, `Validation error: ${(validationError as Error).message}`);
    }
    
    // Get the current inventory item
    const inventoryParams = {
      TableName: process.env.INVENTORY_TABLE,
      Key: {
        productId: adjustmentData.productId,
        locationId: adjustmentData.locationId,
      },
    };

    const existingInventoryItem = await handleDynamoError(async () => {
      const result = await dynamoDb.send(new GetCommand(inventoryParams));
      return result.Item;
    });
    
    // Get the product information for threshold checking
    const productParams = {
      TableName: process.env.PRODUCTS_TABLE,
      Key: {
        productId: adjustmentData.productId,
      },
    };
    
    const productData = await handleDynamoError(async () => {
      const result = await dynamoDb.send(new GetCommand(productParams));
      return result.Item;
    });
    
    if (!productData) {
      return createErrorResponse(404, "Product not found");
    }

    const timestamp = Date.now();
    
    // Calculate new stock level and handle creating or updating inventory record
    const currentStock = existingInventoryItem ? existingInventoryItem.currentStock || 0 : 0;
    const newStockLevel = currentStock + adjustmentData.changeAmount;
    
    // Ensure stock doesn't go negative
    if (newStockLevel < 0) {
      return createErrorResponse(400, "Stock adjustment would result in negative inventory");
    }

    // Update the inventory with new stock level
    const updateParams = {
      TableName: process.env.INVENTORY_TABLE,
      Item: {
        productId: adjustmentData.productId,
        locationId: adjustmentData.locationId,
        currentStock: newStockLevel,
        createdAt: existingInventoryItem ? existingInventoryItem.createdAt : timestamp,
        updatedAt: timestamp,
      },
    };

    await handleDynamoError(() => dynamoDb.send(new PutCommand(updateParams)));
    
    // Record this adjustment in history if history table exists
    if (process.env.INVENTORY_HISTORY_TABLE) {
      const historyData = InventoryHistorySchema.parse({
        historyId: ulid(),
        productId: adjustmentData.productId,
        locationId: adjustmentData.locationId,
        changeAmount: adjustmentData.changeAmount,
        stockBefore: currentStock,
        stockAfter: newStockLevel,
        reason: adjustmentData.reason,
        userId: adjustmentData.userId || "system",
        timestamp
      });
      
      const historyParams = {
        TableName: process.env.INVENTORY_HISTORY_TABLE,
        Item: historyData
      };

      await handleDynamoError(() => dynamoDb.send(new PutCommand(historyParams)));
      console.log("Stock adjustment recorded in history");
    }

    // Check if we need to create an alert
    console.log(`[ALERT CHECK] Stock: ${newStockLevel}, Threshold: ${productData.minThreshold}, Below? ${newStockLevel < productData.minThreshold}`);
    
    const createdAlert = await checkAndCreateAlert({
      productId: adjustmentData.productId,
      locationId: adjustmentData.locationId,
      currentStock: newStockLevel,
      minThreshold: productData.minThreshold
    });
    
    if (createdAlert) {
      console.log(`[ALERT CREATED] ID: ${createdAlert.alertId}`);
    } else {
      console.log(`[NO ALERT CREATED] Stock not below threshold`);
    }

    const responseObject = {
      message: "Stock adjusted successfully",
      inventory: {
        productId: adjustmentData.productId,
        locationId: adjustmentData.locationId,
        previousStock: currentStock,
        currentStock: newStockLevel,
        changeAmount: adjustmentData.changeAmount,
        updatedAt: timestamp
      },
      alert: createdAlert, // Include the alert in the response if one was created
      item: {
        productId: adjustmentData.productId,
        locationId: adjustmentData.locationId,
        previousStock: currentStock,
        currentStock: newStockLevel,
        changeAmount: adjustmentData.changeAmount,
        updatedAt: timestamp
      } // Duplicate for backward compatibility
    };
    
    console.log("Returning response:", JSON.stringify(responseObject, null, 2));
    return createResponse(200, responseObject);
  } catch (error) {
    console.error("Error adjusting stock:", error);
    return createErrorResponse(
      400,
      error instanceof Error ? error.message : "Invalid stock adjustment data"
    );
  }
};

/**
 * Check if an inventory item needs an alert and create one if necessary
 */
async function checkAndCreateAlert(item: {
  productId: string;
  locationId: string;
  currentStock: number;
  minThreshold: number;
}) {
  try {
    // If alerts table is not configured, skip
    if (!process.env.ALERTS_TABLE) {
      console.log("[ALERT] ALERTS_TABLE environment variable is not set");
      return null;
    }

    // Log the threshold check
    console.log(`[ALERT] Checking threshold: ${item.currentStock} < ${item.minThreshold} = ${item.currentStock < item.minThreshold}`);

    // Check if stock is below minimum threshold
    if (item.currentStock < item.minThreshold) {
      console.log("[ALERT] Stock is below threshold, checking for existing alerts");
      
      // Check if there's already an active alert for this product and location
      const existingAlertsParams = {
        TableName: process.env.ALERTS_TABLE,
        FilterExpression: "productId = :pid AND #status = :status",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":pid": item.productId,
          ":status": "NEW"
        }
      };
      
      const existingAlertsResult = await dynamoDb.send(new ScanCommand(existingAlertsParams));
      const existingAlerts = existingAlertsResult.Items || [];
      
      if (existingAlerts.length > 0) {
        console.log(`[ALERT] Found existing active alert for product ${item.productId}. Skipping alert creation.`);
        return existingAlerts[0]; // Return the existing alert
      }
      
      // Generate a unique ID for the alert
      const alertId = ulid();
      console.log(`[ALERT] Generated alertId: ${alertId}`);
      
      // Create the alert object using the schema to ensure proper validation
      const alertData = AlertSchema.parse({
        alertId,
        productId: item.productId,
        locationId: item.locationId,
        alertType: "LOW",
        threshold: item.minThreshold,
        currentStock: item.currentStock,
        status: "NEW",
        createdAt: Date.now()
      });
      
      console.log(`[ALERT] Alert data: ${JSON.stringify(alertData)}`);

      // Create the params for DynamoDB
      const params = {
        TableName: process.env.ALERTS_TABLE,
        Item: alertData,
      };
      
      console.log(`[ALERT] Sending to DynamoDB table: ${process.env.ALERTS_TABLE}`);

      // Send the command to DynamoDB
      try {
        await dynamoDb.send(new PutCommand(params));
        console.log(`[ALERT] Successfully created alert with ID: ${alertId}`);
        return alertData;
      } catch (dbError) {
        console.error(`[ALERT] DynamoDB error creating alert:`, dbError);
        return null;
      }
    } else {
      console.log("[ALERT] Stock is not below threshold, no alert needed");
      return null;
    }
  } catch (error) {
    // Log but don't fail the operation if alert creation fails
    console.error("[ALERT] Error in checkAndCreateAlert:", error);
    return null;
  }
}