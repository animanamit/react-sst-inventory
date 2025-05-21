import { APIGatewayProxyHandler } from "aws-lambda";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  dynamoDb,
  handleDynamoError,
  createResponse,
  createErrorResponse,
} from "../utils/dynamodb";
import { Product } from "../utils/types";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Check request parameters (allow filtering by category if provided)
    const queryParams = event.queryStringParameters || {};
    const category = queryParams.category;
    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : undefined;
    
    console.log("Retrieving products with params:", { category, limit });
    
    // Ensure the table name is specified in environment variables
    if (!process.env.PRODUCTS_TABLE) {
      console.error("Missing PRODUCTS_TABLE environment variable");
      return createErrorResponse(
        500,
        "Server configuration error: Missing products table name"
      );
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
    
    // Get inventory data for each product if inventory table exists
    if (process.env.INVENTORY_TABLE) {
      try {
        console.log("Getting inventory data for all products...");
        
        // First, get all inventory items in one go
        const scanParams = {
          TableName: process.env.INVENTORY_TABLE!
        };
        
        let allInventoryItems = [];
        try {
          const scanResult = await dynamoDb.send(new ScanCommand(scanParams));
          allInventoryItems = scanResult.Items || [];
          console.log(`Found ${allInventoryItems.length} total inventory items`);
          console.log("All inventory items:", JSON.stringify(allInventoryItems));
        } catch (scanError) {
          console.error("Error scanning inventory table:", scanError);
        }
        
        // Now map inventory items to products
        const enhancedProducts = products.map(product => {
          // Find matching inventory items for this product
          const inventoryItems = allInventoryItems.filter(
            item => item.productId === product.productId
          );
          
          console.log(`Product ${product.productId} (${product.name}) has ${inventoryItems.length} inventory items`);
          
          // Calculate total stock across all locations
          const totalStock = inventoryItems.reduce(
            (sum, item) => sum + (item.currentStock || 0), 
            0
          );
          
          console.log(`Total stock for ${product.name}: ${totalStock}`);
          
          // Return product with stock information
          return {
            ...product,
            inventory: inventoryItems,
            totalStock
          };
        });
        
        console.log("Enhanced products with inventory:", JSON.stringify(enhancedProducts));
        return createResponse(200, enhancedProducts);
      } catch (inventoryError) {
        console.error("Error processing inventory data:", inventoryError);
        // Still return products even if inventory fetch fails
        return createResponse(200, products);
      }
    }
    
    // Return just the products if no inventory lookup needed
    return createResponse(200, products);
  } catch (error) {
    console.error("Error retrieving products:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};