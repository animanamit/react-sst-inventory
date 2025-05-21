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
  console.log("Check and create all alerts handler called");
  
  try {
    // Log environment information
    console.log("Environment variables:", {
      ALERTS_TABLE: process.env.ALERTS_TABLE,
      INVENTORY_TABLE: process.env.INVENTORY_TABLE,
      PRODUCTS_TABLE: process.env.PRODUCTS_TABLE,
      NODE_ENV: process.env.NODE_ENV
    });

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
    
    console.log("Fetching inventory items");
    const inventoryResult = await handleDynamoError(async () => {
      return await dynamoDb.send(new ScanCommand(inventoryParams));
    });
    
    const inventoryItems = inventoryResult.Items || [];
    console.log(`Found ${inventoryItems.length} inventory items`);

    // Get all products
    const productsParams = {
      TableName: process.env.PRODUCTS_TABLE,
    };
    
    console.log("Fetching products");
    const productsResult = await handleDynamoError(async () => {
      return await dynamoDb.send(new ScanCommand(productsParams));
    });
    
    const products = productsResult.Items || [];
    console.log(`Found ${products.length} products`);

    // Get existing alerts
    const alertsParams = {
      TableName: process.env.ALERTS_TABLE,
    };
    
    console.log("Fetching existing alerts");
    const alertsResult = await handleDynamoError(async () => {
      return await dynamoDb.send(new ScanCommand(alertsParams));
    });
    
    const existingAlerts = alertsResult.Items || [];
    console.log(`Found ${existingAlerts.length} existing alerts`);

    // Create alerts for products below threshold
    const createdAlerts = [];
    
    for (const product of products) {
      const inventory = inventoryItems.find(i => i.productId === product.productId);
      
      if (inventory) {
        const currentStock = inventory.currentStock;
        const threshold = product.minThreshold;
        
        // If stock is below threshold
        if (currentStock < threshold) {
          console.log(`${product.name} (${product.productId}) has stock=${currentStock} which is below threshold=${threshold}`);
          
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
              
              console.log(`Creating alert for ${product.name}:`, JSON.stringify(alertData, null, 2));
              await handleDynamoError(() => dynamoDb.send(new PutCommand(params)));
              
              console.log(`Alert created for ${product.name} with ID ${alertData.alertId}`);
              createdAlerts.push({
                productId: product.productId,
                productName: product.name,
                alertId: alertData.alertId
              });
            } catch (error) {
              console.error(`Error creating alert for ${product.name}:`, error);
            }
          } else {
            console.log(`Alert already exists for ${product.name}: ${existingAlert.alertId}`);
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