import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  dynamoDb,
  createResponse,
  createErrorResponse,
} from "../utils/dynamodb";
import {
  getRedisClient,
  deleteCache,
} from "../utils/redis";
import { ProductUpdateSchema } from "../utils/types";
import type { Product } from "../utils/types";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Check if request has a body
    if (!event.body) {
      return createErrorResponse(400, "Missing request body");
    }

    // Get product ID from path parameters
    const productId = event.pathParameters?.id;
    if (!productId) {
      return createErrorResponse(400, "Missing product ID");
    }

    // Parse request body
    const body = JSON.parse(event.body);
    
    // Add productId to the body
    body.productId = productId;

    // Validate DynamoDB table environment variable
    if (!process.env.PRODUCTS_TABLE) {
      return createErrorResponse(500, "PRODUCTS_TABLE environment variable is not set");
    }
    
    // Initialize Redis client if enabled
    const redisEnabled = process.env.REDIS_ENABLED === "true";
    let redisClient;
    
    if (redisEnabled) {
      try {
        redisClient = getRedisClient({});
        console.log("Redis client initialized for cache invalidation");
      } catch (redisError) {
        console.error("Redis connection error:", redisError);
        // Continue execution even if Redis fails
      }
    }
    
    // Validate input with zod
    let validatedData;
    try {
      validatedData = ProductUpdateSchema.parse(body);
    } catch (validationError) {
      console.error("Validation error:", validationError);
      return createErrorResponse(400, `Validation error: ${(validationError as Error).message}`);
    }
    
    // Check if the product exists
    const getParams = {
      TableName: process.env.PRODUCTS_TABLE!,
      Key: {
        productId: productId
      },
    };
    
    let existingProduct: Product | undefined;
    try {
      const result = await dynamoDb.send(new GetCommand(getParams));
      existingProduct = result.Item as Product | undefined;
      
      if (!existingProduct) {
        return createErrorResponse(404, `Product with ID ${productId} not found`);
      }
    } catch (dbError) {
      console.error("Database error when checking existing product:", dbError);
      return createErrorResponse(500, `Database error: ${(dbError as Error).message}`);
    }

    // Only update the fields that were provided
    const updateExpression = generateUpdateExpression(validatedData);
    if (!updateExpression.updateExpression) {
      return createErrorResponse(400, "No fields to update provided");
    }

    // Update the product
    const updateParams = {
      TableName: process.env.PRODUCTS_TABLE!,
      Key: {
        productId: productId
      },
      UpdateExpression: updateExpression.updateExpression,
      ExpressionAttributeNames: updateExpression.expressionAttributeNames,
      ExpressionAttributeValues: updateExpression.expressionAttributeValues,
      ReturnValues: "ALL_NEW" as const
    };
    
    let updatedProduct;
    try {
      const result = await dynamoDb.send(new UpdateCommand(updateParams));
      updatedProduct = result.Attributes;
    } catch (updateError) {
      console.error("Error updating product:", updateError);
      return createErrorResponse(500, `Database update error: ${(updateError as Error).message}`);
    }
    
    // Invalidate cache after successful database update
    if (redisEnabled && redisClient) {
      try {
        // Determine which cache keys to invalidate
        const category = existingProduct.category;
        
        // Delete specific product cache
        console.log(`Invalidating cache for updated product: ${productId}`);
        await deleteCache(redisClient, `product:${productId}`);
        
        // Always invalidate the category and all-products caches since they'll contain this product
        const keysToInvalidate = [
          'products:all*', // All products listing
        ];
        
        if (category) {
          keysToInvalidate.push(`products:category:${category}*`); // Category-specific listing
        }
        
        // Invalidate all relevant cache keys
        for (const key of keysToInvalidate) {
          console.log(`Invalidating cache for pattern: ${key}`);
          await deleteCache(redisClient, key);
        }
        
        console.log('Cache invalidation completed successfully');
      } catch (cacheError) {
        console.error("Error invalidating cache:", cacheError);
        // Continue execution even if cache invalidation fails
      }
    }

    return createResponse(200, { 
      message: "Product updated successfully", 
      product: updatedProduct 
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};

// Helper function to generate DynamoDB update expression
function generateUpdateExpression(data: Record<string, any>) {
  const updateExpressionParts = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  // Always update updatedAt timestamp
  updateExpressionParts.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = Date.now();

  // Add other fields
  for (const [key, value] of Object.entries(data)) {
    // Skip productId (primary key) and updatedAt (we always set it)
    if (key === "productId" || key === "updatedAt") continue;
    
    // Skip undefined values
    if (value === undefined) continue;

    const attributeName = `#${key}`;
    const attributeValue = `:${key}`;
    
    updateExpressionParts.push(`${attributeName} = ${attributeValue}`);
    expressionAttributeNames[attributeName] = key;
    expressionAttributeValues[attributeValue] = value;
  }

  if (updateExpressionParts.length === 0) {
    return { updateExpression: null };
  }

  return {
    updateExpression: `SET ${updateExpressionParts.join(", ")}`,
    expressionAttributeNames,
    expressionAttributeValues
  };
}