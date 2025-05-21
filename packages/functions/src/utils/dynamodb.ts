import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB client
const client = new DynamoDBClient({
  // Enable local development mode
  ...(process.env.NODE_ENV === "development" && {
    endpoint: "http://localhost:8000",
    region: "localhost",
    credentials: {
      accessKeyId: "local",
      secretAccessKey: "local",
    },
  }),
});

export const dynamoDb = DynamoDBDocumentClient.from(client);

// Generic error handling wrapper for DynamoDB operations
export async function handleDynamoError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error("DynamoDB operation failed:", error);
    throw new Error(
      error instanceof Error 
        ? `Database operation failed: ${error.message}` 
        : "Unknown database error occurred"
    );
  }
}

// Helper function for API responses
export function createResponse(statusCode: number, body: any) {
  console.log(`Creating response with status code ${statusCode}`);

  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
  };
}

// Utility to create error responses
export function createErrorResponse(statusCode: number, message: string) {
  return createResponse(statusCode, { error: message });
}