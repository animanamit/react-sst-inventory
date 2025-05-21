import { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  dynamoDb,
  handleDynamoError,
  createResponse,
  createErrorResponse,
} from "../utils/dynamodb";
import { ProductSchema, Product } from "../utils/types";
import { ulid } from "ulid";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Debug environment information
    console.log("Environment variables:", {
      PRODUCTS_TABLE: process.env.PRODUCTS_TABLE,
      NODE_ENV: process.env.NODE_ENV
    });
    
    // Debug event information
    console.log("Request event:", {
      path: event.path,
      method: event.httpMethod,
      headers: event.headers,
      body: event.body ? JSON.parse(event.body) : null
    });
    
    // Check if request has a body
    if (!event.body) {
      return createErrorResponse(400, "Missing request body");
    }

    // Parse request body
    const body = JSON.parse(event.body);
    
    console.log("Parsed request body:", body);

    // Validate DynamoDB table environment variable
    if (!process.env.PRODUCTS_TABLE) {
      return createErrorResponse(500, "PRODUCTS_TABLE environment variable is not set");
    }
    
    // Validate input with zod
    let validatedData;
    try {
      validatedData = ProductSchema.parse(body);
      console.log("Data validation successful:", validatedData);
    } catch (validationError) {
      console.error("Validation error:", validationError);
      return createErrorResponse(400, `Validation error: ${(validationError as Error).message}`);
    }
    
    // Check if the product already exists
    if (!validatedData.productId) {
      // Generate a new ID for new products
      validatedData.productId = ulid();
      console.log("Generated new product ID:", validatedData.productId);
    } else {
      // For updates, get the existing record first
      const existingItemParams = {
        TableName: process.env.PRODUCTS_TABLE!,
        Key: {
          productId: validatedData.productId
        },
      };
      
      console.log("Checking for existing product with params:", existingItemParams);

      try {
        const result = await dynamoDb.send(new GetCommand(existingItemParams));
        const existingProduct = result.Item as Product | undefined;
        
        console.log("Existing product query result:", existingProduct);

        if (!existingProduct) {
          // If updating non-existent product, ensure we have all required fields
          console.log("Product not found, ensuring all required fields are present");
          ProductSchema.parse(validatedData);
        }
      } catch (dbError) {
        console.error("Database error when checking existing product:", dbError);
        return createErrorResponse(500, `Database error: ${(dbError as Error).message}`);
      }
    }

    // Update or create the product
    const params = {
      TableName: process.env.PRODUCTS_TABLE!,
      Item: {
        ...validatedData,
        updatedAt: Date.now(),
      },
    };
    
    console.log("Attempting to write product with params:", params);

    try {
      await dynamoDb.send(new PutCommand(params));
      console.log("Product successfully written to database");
    } catch (putError) {
      console.error("Error writing to database:", putError);
      return createErrorResponse(500, `Database write error: ${(putError as Error).message}`);
    }

    return createResponse(200, { 
      message: "Product updated successfully", 
      product: validatedData 
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};