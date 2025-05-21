import { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  dynamoDb,
  handleDynamoError,
  createResponse,
  createErrorResponse,
} from "../utils/dynamodb";
import {
  InventorySchema,
  StockAdjustmentSchema,
  Inventory,
  AlertSchema,
} from "../utils/types";
import { ulid } from "ulid";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {

    // Check if request has a body
    if (!event.body) {
      return createErrorResponse(400, "Missing request body");
    }

    // Parse request body
    const body = JSON.parse(event.body);


    // Validate DynamoDB table environment variables
    if (!process.env.INVENTORY_TABLE) {
      return createErrorResponse(
        500,
        "INVENTORY_TABLE environment variable is not set"
      );
    }

    // Determine which operation to perform based on the request
    // If we're creating/updating an item
    if (body.name !== undefined) {
      return await handleInventoryUpdate(body);
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
async function handleInventoryUpdate(data: any) {
  try {

    // Validate input with zod
    let validatedData;
    try {
      validatedData = InventorySchema.parse(data);
    } catch (validationError) {
      console.error("Validation error:", validationError);
      return createErrorResponse(
        400,
        `Validation error: ${(validationError as Error).message}`
      );
    }

    // Check if the item already exists
    if (!validatedData.productId) {
      // Generate a new ID for new items
      validatedData.productId = ulid();
    } else {
      // For updates, get the existing record first
      const existingItemParams = {
        TableName: process.env.INVENTORY_TABLE!,
        Key: {
          productId: validatedData.productId,
          locationId: validatedData.locationId || "main",
        },
      };


      try {
        const result = await dynamoDb.send(new GetCommand(existingItemParams));
        const existingItem = result.Item as Inventory | undefined;

        if (!existingItem) {
          // If updating non-existent item, ensure we have all required fields
          InventorySchema.parse(validatedData);
        }
      } catch (dbError) {
        console.error("Database error when checking existing item:", dbError);
        return createErrorResponse(
          500,
          `Database error: ${(dbError as Error).message}`
        );
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

    try {
      await dynamoDb.send(new PutCommand(params));
    } catch (putError) {
      console.error("Error writing to database:", putError);
      return createErrorResponse(
        500,
        `Database write error: ${(putError as Error).message}`
      );
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
      item: validatedData,
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
      return result.Item as Inventory | undefined;
    });

    if (!existingItem) {
      return createErrorResponse(404, "Inventory item not found");
    }

    // Calculate new stock level
    const newStockLevel =
      existingItem.currentStock + adjustmentData.changeAmount;

    // Ensure stock doesn't go negative
    if (newStockLevel < 0) {
      return createErrorResponse(
        400,
        "Stock adjustment would result in negative inventory"
      );
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

      await handleDynamoError(() =>
        dynamoDb.send(new PutCommand(historyParams))
      );
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
      },
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
async function checkAndCreateAlert(item: Inventory & { minThreshold?: number }) {
  try {
    // If alerts table is not configured, skip
    if (!process.env.ALERTS_TABLE) {
      return;
    }

    // If minThreshold is not provided in the item, we need to fetch it from the product
    if (!item.minThreshold && process.env.PRODUCTS_TABLE) {
      try {
        const productParams = {
          TableName: process.env.PRODUCTS_TABLE,
          Key: {
            productId: item.productId,
          },
        };
        
        const result = await dynamoDb.send(new GetCommand(productParams));
        if (result.Item) {
          // @ts-ignore - we know the product has minThreshold
          item.minThreshold = result.Item.minThreshold;
        }
      } catch (error) {
        console.error("Error fetching product for threshold:", error);
      }
    }

    // If we still don't have a threshold, we can't create an alert
    if (!item.minThreshold) {
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
    // Only enable this if maxThreshold is defined on the item
    // if (item.maxThreshold && item.currentStock > item.maxThreshold) {
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

  } catch (error) {
    // Log but don't fail the operation if alert creation fails
    console.error("Error creating alert:", error);
  }
}
