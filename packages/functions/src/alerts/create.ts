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
  console.log("Create alert handler called with event:", JSON.stringify(event, null, 2));
  
  try {
    // Log environment information
    console.log("Environment variables:", {
      ALERTS_TABLE: process.env.ALERTS_TABLE,
      NODE_ENV: process.env.NODE_ENV
    });
    
    // Check if request has a body
    if (!event.body) {
      return createErrorResponse(400, "Missing request body");
    }

    // Parse request body
    const body = JSON.parse(event.body);
    console.log("Alert creation request body:", body);

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

    console.log("Validated alert data:", alertData);

    // Create DynamoDB params
    const params = {
      TableName: process.env.ALERTS_TABLE,
      Item: alertData,
    };

    console.log("Sending PutCommand to DynamoDB:", JSON.stringify(params, null, 2));
    await handleDynamoError(() => dynamoDb.send(new PutCommand(params)));
    
    console.log("Alert created successfully with ID:", alertData.alertId);
    
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