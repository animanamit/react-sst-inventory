import { APIGatewayProxyHandler } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  dynamoDb,
  handleDynamoError,
  createResponse,
  createErrorResponse,
} from "../utils/dynamodb";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Ensure the table name is specified in environment variables
    if (!process.env.INVENTORY_HISTORY_TABLE) {
      console.error("Missing INVENTORY_HISTORY_TABLE environment variable");
      return createErrorResponse(
        500,
        "Server configuration error: Missing table name"
      );
    }

    // Get product ID from path parameters
    const productId = event.pathParameters?.productId;
    if (!productId) {
      return createErrorResponse(400, "Missing product ID");
    }

    // Optional location ID from query parameters
    const { locationId } = event.queryStringParameters || {};

    // Set up parameters for DynamoDB query
    const params = {
      TableName: process.env.INVENTORY_HISTORY_TABLE,
      KeyConditionExpression: "productId = :productId",
      ExpressionAttributeValues: {
        ":productId": productId,
      },
      ScanIndexForward: false, // Return items in reverse order (newest first)
    };

    // If locationId is provided, filter by location
    if (locationId) {
      // If we have a specific GSI for product-location, use it
      if (locationId === "main") {
        // Use the default query, as most items will be in the "main" location
        // This is an optimization to avoid a filter expression
      } else {
        // Otherwise, add a filter expression
        params.FilterExpression = "locationId = :locationId";
        params.ExpressionAttributeValues[":locationId"] = locationId;
      }
    }

    // Get history data from DynamoDB
    const result = await handleDynamoError(async () => {
      const data = await dynamoDb.send(new QueryCommand(params));
      return data.Items || [];
    });

    // Return the history records
    return createResponse(200, result);
  } catch (error) {
    console.error("Error retrieving inventory history:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};