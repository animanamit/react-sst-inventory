import { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  dynamoDb,
  handleDynamoError,
  createResponse,
  createErrorResponse,
} from "../utils/dynamodb";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Ensure the table name is specified in environment variables
    if (!process.env.ALERTS_TABLE) {
      console.error("Missing ALERTS_TABLE environment variable");
      return createErrorResponse(
        500,
        "Server configuration error: Missing table name"
      );
    }

    // Get alert ID from path parameters
    const alertId = event.pathParameters?.id;
    if (!alertId) {
      return createErrorResponse(400, "Missing alert ID");
    }

    // Fetch the alert from DynamoDB
    const params = {
      TableName: process.env.ALERTS_TABLE,
      Key: {
        alertId,
      },
    };

    const result = await handleDynamoError(async () => {
      const data = await dynamoDb.send(new GetCommand(params));
      return data.Item;
    });

    // If alert not found
    if (!result) {
      return createErrorResponse(404, "Alert not found");
    }

    // Return the alert
    return createResponse(200, result);
  } catch (error) {
    console.error("Error retrieving alert:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};