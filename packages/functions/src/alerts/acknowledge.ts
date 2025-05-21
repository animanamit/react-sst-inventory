import { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
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

    // Parse request body
    let userId = "system";
    if (event.body) {
      const body = JSON.parse(event.body);
      userId = body.userId || userId;
    }

    // First check if the alert exists
    const getParams = {
      TableName: process.env.ALERTS_TABLE,
      Key: {
        alertId,
      },
    };

    const existingAlert = await handleDynamoError(async () => {
      const data = await dynamoDb.send(new GetCommand(getParams));
      return data.Item;
    });

    // If alert not found
    if (!existingAlert) {
      return createErrorResponse(404, "Alert not found");
    }

    // Skip if already acknowledged
    if (existingAlert.status === "ACKNOWLEDGED") {
      return createResponse(200, {
        message: "Alert was already acknowledged",
        alert: existingAlert,
      });
    }

    const timestamp = Date.now();

    // Update the alert status to ACKNOWLEDGED
    const updateParams = {
      TableName: process.env.ALERTS_TABLE,
      Key: {
        alertId,
      },
      UpdateExpression: "SET #status = :status, acknowledgedAt = :acknowledgedAt, acknowledgedBy = :acknowledgedBy",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": "ACKNOWLEDGED",
        ":acknowledgedAt": timestamp,
        ":acknowledgedBy": userId,
      },
      ReturnValues: "ALL_NEW",
    };

    const result = await handleDynamoError(async () => {
      const data = await dynamoDb.send(new UpdateCommand(updateParams));
      return data.Attributes;
    });

    // Return the updated alert
    return createResponse(200, {
      message: "Alert acknowledged successfully",
      alert: result,
    });
  } catch (error) {
    console.error("Error acknowledging alert:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};