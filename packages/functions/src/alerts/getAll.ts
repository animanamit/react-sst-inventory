import { APIGatewayProxyHandler } from "aws-lambda";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
      return createErrorResponse(
        500,
        "Server configuration error: Missing table name"
      );
    }

    const tableName = process.env.ALERTS_TABLE;
    const { status } = event.queryStringParameters || {};
    
    // If status filter is provided, filter the results
    let result;
    if (status) {
      const scanParams = {
        TableName: tableName,
        FilterExpression: "#status = :status",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":status": status
        }
      };
      
      const data = await dynamoDb.send(new ScanCommand(scanParams));
      result = data.Items || [];
    } else {
      // Otherwise, scan the whole table
      const params = {
        TableName: tableName,
      };

      const data = await dynamoDb.send(new ScanCommand(params));
      result = data.Items || [];
    }

    // Return alerts sorted by creation time (newest first)
    const sortedAlerts = result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    return createResponse(200, sortedAlerts);
  } catch (error) {
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};