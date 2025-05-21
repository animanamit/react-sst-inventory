import { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  dynamoDb,
  handleDynamoError,
  createResponse,
  createErrorResponse,
} from "../utils/dynamodb";
import { AlertSchema } from "../utils/types";
import { ulid } from "ulid";

/**
 * Handler to directly create an alert
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    
    // Check if request has a body
    if (!event.body) {
      return createErrorResponse(400, "Missing request body");
    }

    // Parse request body
    const body = JSON.parse(event.body);

    // Validate environment variables
    if (!process.env.ALERTS_TABLE) {
      return createErrorResponse(500, "ALERTS_TABLE environment variable is not set");
    }

    // Use the AlertSchema to validate and create the alert with a generated alertId
    const alertData = AlertSchema.parse({
      alertId: ulid(), // Explicitly generate the ID
      productId: body.productId,
      locationId: body.locationId || "main",
      alertType: body.alertType || "LOW",
      threshold: body.threshold,
      currentStock: body.currentStock,
      status: body.status || "NEW",
      createdAt: Date.now(),
    });

    // Create DynamoDB params
    const params = {
      TableName: process.env.ALERTS_TABLE,
      Item: alertData,
    };

    await handleDynamoError(() => dynamoDb.send(new PutCommand(params)));
    
    return createResponse(201, {
      message: "Alert created successfully",
      alert: alertData
    });
  } catch (error) {
    console.error("Error creating alert:", error);
    console.error("Error details:", error instanceof Error ? error.stack : String(error));
    return createErrorResponse(
      400,
      error instanceof Error ? error.message : "Unknown error creating alert"
    );
  }
};