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
  AlertSchema,
  AlertMessageSchema
} from "../utils/types";
import { sendSqsMessage, handleSqsError } from "../utils/sqs";
import { getRedisClient, deleteCache } from "../utils/redis";
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
    
    // Initialize Redis client if enabled
    const redisEnabled = process.env.REDIS_ENABLED === "true";
    let redisClient;
    
    if (redisEnabled) {
      try {
        redisClient = getRedisClient({});
        console.log("Redis client initialized for cache invalidation in adjustStock");
      } catch (redisError) {
        console.error("Redis connection error:", redisError);
        // Continue execution even if Redis fails
      }
    }
    
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
    }
    
    // Invalidate cache since inventory data has changed
    if (redisEnabled && redisClient) {
      try {
        // Inventory cache keys may not exist yet, but we'll create a pattern
        // based on what we would use if we implement caching for inventory
        const inventoryCacheKey = `inventory:*`;
        
        // We also need to invalidate product cache as it contains inventory data
        const productCacheKey = `products:*`;
        
        // Additionally, invalidate any product-specific cache for this product
        const productSpecificKey = `product:${adjustmentData.productId}`;
        
        // List of cache keys to invalidate
        const keysToInvalidate = [inventoryCacheKey, productCacheKey, productSpecificKey];
        
        // Invalidate all relevant cache keys
        for (const key of keysToInvalidate) {
          console.log(`Invalidating cache for pattern: ${key}`);
          await deleteCache(redisClient, key);
        }
        
        console.log('Cache invalidation completed successfully in adjustStock');
      } catch (cacheError) {
        console.error("Error invalidating cache:", cacheError);
        // Continue execution even if cache invalidation fails
      }
    }

    // Check if we need to create an alert
    const createdAlert = await checkAndCreateAlert({
      productId: adjustmentData.productId,
      locationId: adjustmentData.locationId,
      currentStock: newStockLevel,
      minThreshold: productData.minThreshold
    });

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
 * Check if an inventory item needs an alert and send to SQS queue for processing
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
      return null;
    }

    // Check if SQS queue URL is configured
    const queueUrl = process.env.ALERTS_QUEUE;
    const useSqs = !!queueUrl;

    // Check if stock is below minimum threshold
    if (item.currentStock < item.minThreshold) {
      // SQS implementation - send alert request to queue for processing
      if (useSqs) {
        try {
          // Create alert message for SQS
          const alertMessage = AlertMessageSchema.parse({
            type: "ALERT_REQUEST",
            payload: {
              productId: item.productId,
              locationId: item.locationId,
              currentStock: item.currentStock,
              minThreshold: item.minThreshold,
              alertType: "LOW",
              timestamp: Date.now(),
              requestId: ulid(),
            }
          });

          // Send to SQS queue
          await handleSqsError(async () => {
            return sendSqsMessage(
              queueUrl,
              alertMessage,
              "inventory-alerts", // Message group ID
              `${item.productId}-${item.locationId}` // Deduplication ID
            );
          });

          // Return a placeholder for the alert (will be created by the SQS consumer)
          return {
            alertId: "pending",
            productId: item.productId,
            locationId: item.locationId,
            alertType: "LOW",
            threshold: item.minThreshold,
            currentStock: item.currentStock,
            status: "PROCESSING",
            createdAt: Date.now(),
            sqsMessage: "Alert request sent to queue for processing"
          };
        } catch (sqsError) {
          console.error("Error sending alert to SQS:", sqsError);
          // Fall back to direct creation if SQS fails
          console.warn("Falling back to direct alert creation due to SQS error");
        }
      }

      // Direct creation (fallback or when SQS is not configured)
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
        return existingAlerts[0]; // Return the existing alert
      }
      
      // Generate a unique ID for the alert
      const alertId = ulid();
      
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

      // Create the params for DynamoDB
      const params = {
        TableName: process.env.ALERTS_TABLE,
        Item: alertData,
      };

      // Send the command to DynamoDB
      try {
        await dynamoDb.send(new PutCommand(params));
        return alertData;
      } catch (dbError) {
        console.error(`DynamoDB error creating alert:`, dbError);
        return null;
      }
    } else {
      return null;
    }
  } catch (error) {
    // Log but don't fail the operation if alert creation fails
    console.error("Error in checkAndCreateAlert:", error);
    return null;
  }
}