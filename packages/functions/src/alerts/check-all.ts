import { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  dynamoDb,
  handleDynamoError,
  createResponse,
  createErrorResponse,
} from "../utils/dynamodb";
import { AlertSchema } from "../utils/types";
import { ulid } from "ulid";

/**
 * Handler to check all inventory items and create alerts for those below threshold
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  try {

    // Validate environment variables
    if (!process.env.ALERTS_TABLE) {
      return createErrorResponse(500, "ALERTS_TABLE environment variable is not set");
    }
    
    if (!process.env.INVENTORY_TABLE) {
      return createErrorResponse(500, "INVENTORY_TABLE environment variable is not set");
    }
    
    if (!process.env.PRODUCTS_TABLE) {
      return createErrorResponse(500, "PRODUCTS_TABLE environment variable is not set");
    }

    // Get all inventory items
    const inventoryParams = {
      TableName: process.env.INVENTORY_TABLE,
    };
    
    const inventoryResult = await handleDynamoError(async () => {
      return await dynamoDb.send(new ScanCommand(inventoryParams));
    });
    
    const inventoryItems = inventoryResult.Items || [];

    // Get all products
    const productsParams = {
      TableName: process.env.PRODUCTS_TABLE,
    };
    
    const productsResult = await handleDynamoError(async () => {
      return await dynamoDb.send(new ScanCommand(productsParams));
    });
    
    const products = productsResult.Items || [];

    // Get existing alerts
    const alertsParams = {
      TableName: process.env.ALERTS_TABLE,
    };
    
    const alertsResult = await handleDynamoError(async () => {
      return await dynamoDb.send(new ScanCommand(alertsParams));
    });
    
    const existingAlerts = alertsResult.Items || [];

    // Create alerts for products below threshold
    const createdAlerts = [];
    
    for (const product of products) {
      const inventory = inventoryItems.find(i => i.productId === product.productId);
      
      if (inventory) {
        const currentStock = inventory.currentStock;
        const threshold = product.minThreshold;
        
        // If stock is below threshold
        if (currentStock < threshold) {
          // Check if we already have an active alert
          const existingAlert = existingAlerts.find(a => 
            a.productId === product.productId && 
            a.status === "NEW"
          );
          
          if (!existingAlert) {
            try {
              // Create the alert
              const alertData = AlertSchema.parse({
                alertId: ulid(),
                productId: product.productId,
                locationId: inventory.locationId || "main",
                alertType: "LOW",
                threshold: threshold,
                currentStock: currentStock,
                status: "NEW",
                createdAt: Date.now(),
              });
              
              const params = {
                TableName: process.env.ALERTS_TABLE,
                Item: alertData,
              };
              
              await handleDynamoError(() => dynamoDb.send(new PutCommand(params)));
              
              createdAlerts.push({
                productId: product.productId,
                productName: product.name,
                alertId: alertData.alertId
              });
            } catch (error) {
              console.error(`Error creating alert for ${product.name}:`, error);
            }
          }
        }
      }
    }
    
    return createResponse(200, {
      message: `Created ${createdAlerts.length} alerts`,
      alerts: createdAlerts
    });
  } catch (error) {
    console.error("Error checking and creating alerts:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};