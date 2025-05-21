import { APIGatewayProxyHandler } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  dynamoDb,
  handleDynamoError,
  createResponse,
  createErrorResponse,
} from "../utils/dynamodb";

/**
 * Debug endpoint to check the contents of inventory tables
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Check environment variables
    console.log("Environment variables:", {
      INVENTORY_TABLE: process.env.INVENTORY_TABLE,
      PRODUCTS_TABLE: process.env.PRODUCTS_TABLE,
      NODE_ENV: process.env.NODE_ENV,
    });

    // Ensure the tables exists
    if (!process.env.INVENTORY_TABLE) {
      return createErrorResponse(500, "INVENTORY_TABLE environment variable is not set");
    }

    if (!process.env.PRODUCTS_TABLE) {
      return createErrorResponse(500, "PRODUCTS_TABLE environment variable is not set");
    }

    // Get all inventory items
    const inventoryParams = {
      TableName: process.env.INVENTORY_TABLE,
      Limit: 100,
    };

    console.log("Scanning inventory table:", inventoryParams);
    const inventoryResult = await handleDynamoError(async () => {
      return await dynamoDb.send(new ScanCommand(inventoryParams));
    });

    // Get all products
    const productsParams = {
      TableName: process.env.PRODUCTS_TABLE,
      Limit: 100,
    };

    console.log("Scanning products table:", productsParams);
    const productsResult = await handleDynamoError(async () => {
      return await dynamoDb.send(new ScanCommand(productsParams));
    });

    // Return combined data for debugging
    return createResponse(200, {
      tables: {
        inventory: process.env.INVENTORY_TABLE,
        products: process.env.PRODUCTS_TABLE,
      },
      counts: {
        inventory: inventoryResult.Items?.length || 0,
        products: productsResult.Items?.length || 0,
      },
      items: {
        inventory: inventoryResult.Items || [],
        products: productsResult.Items || [],
      },
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};