import { APIGatewayProxyHandler } from "aws-lambda";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
import { Product } from "../utils/types";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Check request parameters (allow filtering by category if provided)
    const queryParams = event.queryStringParameters || {};
    const category = queryParams.category;
    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : undefined;
    
    // Ensure the table name is specified in environment variables
    if (!process.env.PRODUCTS_TABLE) {
      return createErrorResponse(
        500,
        "Server configuration error: Missing products table name"
      );
    }
    
    // Initialize Redis client if enabled
    const redisEnabled = process.env.REDIS_ENABLED === "true";
    let redisClient;
    let cacheKey = "";
    
    if (redisEnabled) {
      try {
        redisClient = getRedisClient({});
        // Create a cache key based on the request parameters
        cacheKey = category 
          ? `products:category:${category}${limit ? `:limit:${limit}` : ""}`
          : `products:all${limit ? `:limit:${limit}` : ""}`;
          
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

    let products: Product[] = [];
    
    // If category is provided, use a query with a GSI
    if (category && process.env.CATEGORY_INDEX) {
      const queryParams = {
        TableName: process.env.PRODUCTS_TABLE,
        IndexName: process.env.CATEGORY_INDEX,
        KeyConditionExpression: "category = :category",
        ExpressionAttributeValues: {
          ":category": category
        },
        Limit: limit
      };
      
      const result = await handleDynamoError(async () => {
        const data = await dynamoDb.send(new QueryCommand(queryParams));
        return data.Items as Product[] || [];
      });
      
      products = result;
    } 
    // Otherwise perform a table scan
    else {
      const scanParams = {
        TableName: process.env.PRODUCTS_TABLE,
        Limit: limit
      };
      
      const result = await handleDynamoError(async () => {
        const data = await dynamoDb.send(new ScanCommand(scanParams));
        return data.Items as Product[] || [];
      });
      
      products = result;
    }
    
    let responseData = products;
    
    // Get inventory data for each product if inventory table exists
    if (process.env.INVENTORY_TABLE) {
      try {
        // First, get all inventory items in one go
        const scanParams = {
          TableName: process.env.INVENTORY_TABLE!
        };
        
        let allInventoryItems = [];
        try {
          const scanResult = await dynamoDb.send(new ScanCommand(scanParams));
          allInventoryItems = scanResult.Items || [];
        } catch (scanError) {
          console.error("Error scanning inventory table:", scanError);
        }
        
        // Now map inventory items to products
        const enhancedProducts = products.map(product => {
          // Find matching inventory items for this product
          const inventoryItems = allInventoryItems.filter(
            item => item.productId === product.productId
          );
          
          // Calculate total stock across all locations
          const totalStock = inventoryItems.reduce(
            (sum, item) => sum + (item.currentStock || 0), 
            0
          );
          
          // Return product with stock information
          return {
            ...product,
            inventory: inventoryItems,
            totalStock
          };
        });
        
        responseData = enhancedProducts;
      } catch (inventoryError) {
        console.error("Error processing inventory data:", inventoryError);
        // Still return products even if inventory fetch fails
        responseData = products;
      }
    }
    
    // Cache the results if Redis is enabled
    if (redisEnabled && redisClient && cacheKey) {
      try {
        // Get cache TTL from environment or use default (1 hour)
        const cacheTtl = process.env.REDIS_TTL 
          ? parseInt(process.env.REDIS_TTL, 10) 
          : 3600;
          
        await setCache(redisClient, cacheKey, responseData, cacheTtl);
        console.log(`Cached data at ${cacheKey} for ${cacheTtl} seconds`);
      } catch (cacheError) {
        console.error("Error caching data:", cacheError);
        // Continue execution even if caching fails
      }
    }
    
    // Return the response data
    return createResponse(200, responseData);
  } catch (error) {
    console.error("Error retrieving products:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};