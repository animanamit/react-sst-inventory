import type { APIGatewayProxyHandler } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  dynamoDb,
  handleDynamoError,
  createResponse,
  createErrorResponse,
} from "../utils/dynamodb";
import {
  getRedisClient,
  getCache,
  setCache,
} from "../utils/redis";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Ensure the table name is specified in environment variables
    if (!process.env.INVENTORY_TABLE) {
      return createErrorResponse(
        500,
        "Server configuration error: Missing table name"
      );
    }
    
    // Initialize Redis client if enabled
    const redisEnabled = process.env.REDIS_ENABLED === "true";
    let redisClient;
    let cacheKey = "";
    
    if (redisEnabled) {
      try {
        redisClient = getRedisClient({});
        // Create a cache key
        cacheKey = "inventory:all";
        
        // Try to get cached data first
        const cachedData = await getCache<any>(redisClient, cacheKey);
        if (cachedData) {
          console.log(`Cache hit for ${cacheKey}`);
          return createResponse(200, cachedData);
        }
        console.log(`Cache miss for ${cacheKey}`);
      } catch (redisError) {
        console.error("Redis connection error:", redisError);
        // Continue execution even if Redis fails
      }
    }

    const params = {
      TableName: process.env.INVENTORY_TABLE,
    };

    // Scan the inventory table for all items
    const result = await handleDynamoError(async () => {
      const data = await dynamoDb.send(new ScanCommand(params));
      return data.Items || [];
    });
    
    // Cache the results if Redis is enabled
    if (redisEnabled && redisClient && cacheKey) {
      try {
        // Get cache TTL from environment or use default (30 minutes)
        const cacheTtl = process.env.REDIS_TTL 
          ? parseInt(process.env.REDIS_TTL, 10) 
          : 1800;
          
        await setCache(redisClient, cacheKey, result, cacheTtl);
        console.log(`Cached inventory data at ${cacheKey} for ${cacheTtl} seconds`);
      } catch (cacheError) {
        console.error("Error caching inventory data:", cacheError);
        // Continue execution even if caching fails
      }
    }

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
