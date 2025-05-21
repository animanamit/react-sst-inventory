import { APIGatewayProxyHandler } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  dynamoDb,
  handleDynamoError,
  createResponse,
  createErrorResponse,
} from "../utils/dynamodb";

export const handler: APIGatewayProxyHandler = async () => {
  try {
    // Ensure the table name is specified in environment variables
    if (!process.env.INVENTORY_TABLE) {
      console.error("Missing INVENTORY_TABLE environment variable");
      return createErrorResponse(
        500,
        "Server configuration error: Missing table name"
      );
    }

    const params = {
      TableName: process.env.INVENTORY_TABLE,
    };

    // Scan the inventory table for all items
    const result = await handleDynamoError(async () => {
      const data = await dynamoDb.send(new ScanCommand(params));
      return data.Items || [];
    });

    // Return the inventory items
    return createResponse(200, result);
  } catch (error) {
    console.error("Error retrieving inventory items:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};
