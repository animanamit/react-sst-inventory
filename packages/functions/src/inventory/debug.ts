import type { APIGatewayProxyHandler } from "aws-lambda";
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
    // Ensure the tables exists
    if (!process.env.INVENTORY_TABLE) {
      return createErrorResponse(
        500,
        "INVENTORY_TABLE environment variable is not set"
      );
    }

    if (!process.env.PRODUCTS_TABLE) {
      return createErrorResponse(
        500,
        "PRODUCTS_TABLE environment variable is not set"
      );
    }

    // Get all inventory items
    const inventoryParams = {
      TableName: process.env.INVENTORY_TABLE,
      Limit: 100,
    };

    const inventoryResult = await handleDynamoError(async () => {
      return await dynamoDb.send(new ScanCommand(inventoryParams));
    });

    // Get all products
    const productsParams = {
      TableName: process.env.PRODUCTS_TABLE,
      Limit: 100,
    };

    const productsResult = await handleDynamoError(async () => {
      return await dynamoDb.send(new ScanCommand(productsParams));
    });

    // Initialize alert items and history items as empty arrays
    let alertItems: any[] = [];
    let historyItems: any[] = [];

    // Get all alerts if the alerts table is available
    if (process.env.ALERTS_TABLE) {
      const alertsParams = {
        TableName: process.env.ALERTS_TABLE,
        Limit: 100,
      };

      const alertsResult = await handleDynamoError(async () => {
        return await dynamoDb.send(new ScanCommand(alertsParams));
      });

      alertItems = alertsResult.Items || [];
    }

    // Get inventory history if the history table is available
    if (process.env.INVENTORY_HISTORY_TABLE) {
      const historyParams = {
        TableName: process.env.INVENTORY_HISTORY_TABLE,
        Limit: 100,
      };

      const historyResult = await handleDynamoError(async () => {
        return await dynamoDb.send(new ScanCommand(historyParams));
      });

      historyItems = historyResult.Items || [];
    }

    // Return combined data for debugging
    return createResponse(200, {
      tables: {
        inventory: process.env.INVENTORY_TABLE,
        products: process.env.PRODUCTS_TABLE,
        alerts: process.env.ALERTS_TABLE || "Not configured",
        history: process.env.INVENTORY_HISTORY_TABLE || "Not configured",
      },
      counts: {
        inventory: inventoryResult.Items?.length || 0,
        products: productsResult.Items?.length || 0,
        alerts: alertItems.length || 0,
        history: historyItems.length || 0,
      },
      items: {
        inventory: inventoryResult.Items || [],
        products: productsResult.Items || [],
        alerts: alertItems || [],
        history: historyItems || [],
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
