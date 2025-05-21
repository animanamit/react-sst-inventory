import { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
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
    // Debug environment information
    console.log("Environment variables:", {
      INVENTORY_TABLE: process.env.INVENTORY_TABLE,
      PRODUCTS_TABLE: process.env.PRODUCTS_TABLE,
      INVENTORY_HISTORY_TABLE: process.env.INVENTORY_HISTORY_TABLE,
      ALERTS_TABLE: process.env.ALERTS_TABLE,
      NODE_ENV: process.env.NODE_ENV
    });
    
    // Check if request has a body
    if (!event.body) {
      return createErrorResponse(400, "Missing request body");
    }

    // Parse request body
    const body = JSON.parse(event.body);
    console.log("Parsed request body:", body);

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

    // Check if we need to create an alert after the stock adjustment
    await checkAndCreateAlert({
      productId: adjustmentData.productId,
      locationId: adjustmentData.locationId,
      currentStock: newStockLevel,
      minThreshold: productData.minThreshold
    });

    return createResponse(200, { 
      message: "Stock adjusted successfully",
      inventory: {
        productId: adjustmentData.productId,
        locationId: adjustmentData.locationId,
        previousStock: currentStock,
        currentStock: newStockLevel,
        changeAmount: adjustmentData.changeAmount,
        updatedAt: timestamp
      }
    });
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
      return;
    }

    let alertType = null;
    let threshold = 0;
    
    // Check if stock is below minimum threshold
    if (item.currentStock < item.minThreshold) {
      alertType = "LOW";
      threshold = item.minThreshold;
    }
    // We could also add "HIGH" alerts if stock exceeds a maximum threshold
    // if (item.currentStock > item.maxThreshold) {
    //   alertType = "HIGH";
    //   threshold = item.maxThreshold;
    // }

    // If no alert needed, return
    if (!alertType) {
      return;
    }

    // Create the alert
    const alertData = AlertSchema.parse({
      productId: item.productId,
      locationId: item.locationId,
      alertType,
      threshold,
      currentStock: item.currentStock,
      status: "NEW",
    });

    const params = {
      TableName: process.env.ALERTS_TABLE,
      Item: alertData,
    };

    await handleDynamoError(() => dynamoDb.send(new PutCommand(params)));
    
    console.log(`Created ${alertType} stock alert for product ${item.productId}`);
  } catch (error) {
    // Log but don't fail the operation if alert creation fails
    console.error("Error creating alert:", error);
  }
}