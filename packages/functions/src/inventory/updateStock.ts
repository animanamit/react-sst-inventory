import { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { 
  dynamoDb, 
  handleDynamoError, 
  createResponse, 
  createErrorResponse 
} from "../utils/dynamodb";
import { 
  InventoryItemSchema, 
  StockAdjustmentSchema,
  InventoryItem,
  AlertSchema
} from "../utils/types";
import { ulid } from "ulid";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Debug environment information
    console.log("Environment variables:", {
      INVENTORY_TABLE: process.env.INVENTORY_TABLE,
      NODE_ENV: process.env.NODE_ENV,
      ALERTS_TABLE: process.env.ALERTS_TABLE,
      INVENTORY_HISTORY_TABLE: process.env.INVENTORY_HISTORY_TABLE
    });
    
    // Debug event information
    console.log("Request event:", {
      path: event.path,
      method: event.httpMethod,
      headers: event.headers,
      queryStringParameters: event.queryStringParameters,
      body: event.body ? JSON.parse(event.body) : null
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

    // Determine which operation to perform based on the request
    // If we're creating/updating an item
    if (body.name !== undefined) {
      return await handleInventoryItemUpdate(body);
    } 
    // If we're adjusting stock
    else if (body.changeAmount !== undefined) {
      return await handleStockAdjustment(body);
    } 
    // Invalid request
    else {
      return createErrorResponse(400, "Invalid request format");
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};

/**
 * Handle creating or updating an inventory item
 */
async function handleInventoryItemUpdate(data: any) {
  try {
    console.log("Starting inventory item update with data:", data);
    console.log("Using table:", process.env.INVENTORY_TABLE);
    
    // Validate input with zod
    let validatedData;
    try {
      validatedData = InventoryItemSchema.parse(data);
      console.log("Data validation successful:", validatedData);
    } catch (validationError) {
      console.error("Validation error:", validationError);
      return createErrorResponse(400, `Validation error: ${(validationError as Error).message}`);
    }
    
    // Check if the item already exists
    if (!validatedData.productId) {
      // Generate a new ID for new items
      validatedData.productId = ulid();
      console.log("Generated new product ID:", validatedData.productId);
    } else {
      // For updates, get the existing record first
      const existingItemParams = {
        TableName: process.env.INVENTORY_TABLE!,
        Key: {
          productId: validatedData.productId,
          locationId: validatedData.locationId || "main",
        },
      };
      
      console.log("Checking for existing item with params:", existingItemParams);

      try {
        const result = await dynamoDb.send(new GetCommand(existingItemParams));
        const existingItem = result.Item as InventoryItem | undefined;
        
        console.log("Existing item query result:", existingItem);

        if (!existingItem) {
          // If updating non-existent item, ensure we have all required fields
          console.log("Item not found, ensuring all required fields are present");
          InventoryItemSchema.parse(validatedData);
        }
      } catch (dbError) {
        console.error("Database error when checking existing item:", dbError);
        return createErrorResponse(500, `Database error: ${(dbError as Error).message}`);
      }
    }

    // Update or create the item
    const params = {
      TableName: process.env.INVENTORY_TABLE!,
      Item: {
        ...validatedData,
        updatedAt: Date.now(),
      },
    };
    
    console.log("Attempting to write item with params:", params);

    try {
      await dynamoDb.send(new PutCommand(params));
      console.log("Item successfully written to database");
    } catch (putError) {
      console.error("Error writing to database:", putError);
      return createErrorResponse(500, `Database write error: ${(putError as Error).message}`);
    }

    // Check if we need to create an alert
    try {
      await checkAndCreateAlert(validatedData);
    } catch (alertError) {
      console.warn("Alert creation error (non-fatal):", alertError);
      // Continue even if alert creation fails
    }

    return createResponse(200, { 
      message: "Inventory item updated successfully", 
      item: validatedData 
    });
  } catch (error) {
    console.error("Unhandled error in inventory update:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
}

/**
 * Handle adjusting stock levels (increment/decrement)
 */
async function handleStockAdjustment(data: any) {
  try {
    // Validate the adjustment data
    const adjustmentData = StockAdjustmentSchema.parse(data);
    
    // Get the current inventory item
    const params = {
      TableName: process.env.INVENTORY_TABLE!,
      Key: {
        productId: adjustmentData.productId,
        locationId: adjustmentData.locationId,
      },
    };

    const existingItem = await handleDynamoError(async () => {
      const result = await dynamoDb.send(new GetCommand(params));
      return result.Item as InventoryItem | undefined;
    });

    if (!existingItem) {
      return createErrorResponse(404, "Inventory item not found");
    }

    // Calculate new stock level
    const newStockLevel = existingItem.currentStock + adjustmentData.changeAmount;
    
    // Ensure stock doesn't go negative
    if (newStockLevel < 0) {
      return createErrorResponse(400, "Stock adjustment would result in negative inventory");
    }

    // Update the inventory with new stock level
    const updateParams = {
      TableName: process.env.INVENTORY_TABLE!,
      Item: {
        ...existingItem,
        currentStock: newStockLevel,
        updatedAt: Date.now(),
      },
    };

    await handleDynamoError(() => dynamoDb.send(new PutCommand(updateParams)));
    
    // Record this adjustment in history (if history table exists)
    if (process.env.INVENTORY_HISTORY_TABLE) {
      const historyParams = {
        TableName: process.env.INVENTORY_HISTORY_TABLE,
        Item: {
          productId: adjustmentData.productId,
          timestamp: Date.now(),
          locationId: adjustmentData.locationId,
          changeAmount: adjustmentData.changeAmount,
          stockAfter: newStockLevel,
          changeReason: adjustmentData.reason,
          changedBy: adjustmentData.userId || "system",
        },
      };

      await handleDynamoError(() => dynamoDb.send(new PutCommand(historyParams)));
    }

    // Check if we need to create an alert after the stock adjustment
    await checkAndCreateAlert({
      ...existingItem,
      currentStock: newStockLevel,
    });

    return createResponse(200, { 
      message: "Stock adjusted successfully",
      item: {
        ...existingItem,
        currentStock: newStockLevel,
      }
    });
  } catch (error) {
    console.error("Error adjusting stock:", error);
    return createErrorResponse(
      400,
      error instanceof Error ? error.message : "Invalid stock adjustment data"
    );
  }
}

/**
 * Check if an inventory item needs an alert and create one if necessary
 */
async function checkAndCreateAlert(item: InventoryItem) {
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
    
    // You could also send the alert to an SQS queue for processing
    // if (process.env.ALERTS_QUEUE_URL) {
    //   // Send to SQS...
    // }

    console.log(`Created ${alertType} stock alert for product ${item.productId}`);
  } catch (error) {
    // Log but don't fail the operation if alert creation fails
    console.error("Error creating alert:", error);
  }
}