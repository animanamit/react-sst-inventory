import { APIGatewayProxyHandler } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  dynamoDb,
  handleDynamoError,
  createResponse,
  createErrorResponse,
} from "../utils/dynamodb";
import { ProductSchema } from "../utils/types";
import { ulid } from "ulid";

// Mock product data to seed the database
const mockProducts = [
  {
    name: "Organic Cotton T-Shirt",
    description: "Soft, eco-friendly cotton t-shirt in various colors.",
    category: "Apparel",
    sku: "APP-TSHIRT-001",
    imageUrl: "/plain-white-tshirt.png",
    minThreshold: 20,
  },
  {
    name: "Handcrafted Ceramic Mug",
    description: "Artisan-made ceramic mug, perfect for coffee or tea.",
    category: "Kitchenware",
    sku: "KIT-MUG-001",
    imageUrl: "/ceramic-mug.png",
    minThreshold: 15,
  },
  {
    name: "Leather Wallet",
    description: "Premium leather wallet with multiple card slots.",
    category: "Accessories",
    sku: "ACC-WALLET-001",
    imageUrl: "/leather-wallet-contents.png",
    minThreshold: 10,
  },
  {
    name: "Stainless Steel Water Bottle",
    description: "Eco-friendly, double-walled insulated water bottle.",
    category: "Kitchenware",
    sku: "KIT-BOTTLE-001",
    imageUrl: "/reusable-water-bottle.png",
    minThreshold: 25,
  },
  {
    name: "Wireless Earbuds",
    description: "Bluetooth earbuds with charging case and noise cancellation.",
    category: "Electronics",
    sku: "ELEC-EARBUD-001",
    imageUrl: "/wireless-earbuds-charging-case.png",
    minThreshold: 8,
  },
  {
    name: "Scented Candle",
    description: "Hand-poured soy wax candle with essential oils.",
    category: "Home",
    sku: "HOME-CANDLE-001",
    imageUrl: "/lit-candle.png",
    minThreshold: 12,
  },
  {
    name: "Bamboo Cutting Board",
    description: "Sustainable bamboo cutting board for kitchen use.",
    category: "Kitchenware",
    sku: "KIT-BOARD-001",
    imageUrl: "/wooden-cutting-board.png",
    minThreshold: 5,
  },
  {
    name: "Organic Lip Balm",
    description: "Natural lip balm made with organic ingredients.",
    category: "Beauty",
    sku: "BEAUTY-LIP-001",
    imageUrl: "/lip-balm.png",
    minThreshold: 15,
  },
  {
    name: "Recycled Paper Notebook",
    description: "Eco-friendly notebook made from recycled paper.",
    category: "Stationery",
    sku: "STAT-NOTEBOOK-001",
    imageUrl: "/open-notebook-desk.png",
    minThreshold: 10,
  },
  {
    name: "Handmade Soap Bar",
    description: "Natural soap bar made with essential oils and botanicals.",
    category: "Beauty",
    sku: "BEAUTY-SOAP-001",
    imageUrl: "/bar-of-lavender-soap.png",
    minThreshold: 12,
  },
];

// Initial inventory data to seed along with products
const initialInventory = [
  { productId: "", locationId: "main", currentStock: 45 }, // Organic Cotton T-Shirt
  { productId: "", locationId: "main", currentStock: 12 }, // Handcrafted Ceramic Mug
  { productId: "", locationId: "main", currentStock: 8 },  // Leather Wallet
  { productId: "", locationId: "main", currentStock: 30 }, // Stainless Steel Water Bottle
  { productId: "", locationId: "main", currentStock: 5 },  // Wireless Earbuds
  { productId: "", locationId: "main", currentStock: 18 }, // Scented Candle
  { productId: "", locationId: "main", currentStock: 0 },  // Bamboo Cutting Board
  { productId: "", locationId: "main", currentStock: 22 }, // Organic Lip Balm
  { productId: "", locationId: "main", currentStock: 3 },  // Recycled Paper Notebook
  { productId: "", locationId: "main", currentStock: 14 }, // Handmade Soap Bar
];

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Check for required environment variables
    if (!process.env.PRODUCTS_TABLE) {
      return createErrorResponse(500, "PRODUCTS_TABLE environment variable is not set");
    }
    
    if (!process.env.INVENTORY_TABLE) {
      return createErrorResponse(500, "INVENTORY_TABLE environment variable is not set");
    };
    
    // Parse request body if exists to check for options
    const options = event.body ? JSON.parse(event.body) : {};
    const clearExisting = options.clearExisting === true;
    const forceIdempotent = options.forceIdempotent !== false; // Default to true
    
    // Seed products and track product IDs
    const productIds: string[] = [];
    const timestamp = Date.now();
    const results = [];
    
    // Create all products with idempotent IDs (for testing, real version should use random IDs)
    for (let i = 0; i < mockProducts.length; i++) {
      try {
        const productData = mockProducts[i];
        
        // Generate a new product ID if not in development mode (in dev mode, use predictable IDs)
        const productId = (process.env.NODE_ENV === "development" || forceIdempotent)
          ? `product-${i+1}` 
          : ulid();
        
        // Create a valid product object with the schema
        const product = ProductSchema.parse({
          ...productData,
          productId,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        
        // Store the product in DynamoDB
        const params = {
          TableName: process.env.PRODUCTS_TABLE,
          Item: product,
        };
        
        try {
          await dynamoDb.send(new PutCommand(params));
          
          productIds.push(productId);
          results.push({
            type: "product",
            success: true,
            name: product.name,
            id: productId
          });
          
          // Create inventory record for this product
          if (initialInventory[i]) {
            // Make sure we set the correct fields for inventory
            const inventoryItem = {
              productId: productId,
              locationId: initialInventory[i].locationId || "main",
              currentStock: initialInventory[i].currentStock,
              createdAt: timestamp,
              updatedAt: timestamp,
            };
            
            const inventoryParams = {
              TableName: process.env.INVENTORY_TABLE,
              Item: inventoryItem,
            };
            
            try {
              await dynamoDb.send(new PutCommand(inventoryParams));
              
              results.push({
                type: "inventory",
                success: true,
                productId: productId,
                stock: inventoryItem.currentStock
              });
            } catch (invError) {
              console.error(`Error creating inventory for ${product.name}:`, invError);
              results.push({
                type: "inventory",
                success: false,
                productId: productId,
                error: invError instanceof Error ? invError.message : "Unknown error"
              });
            }
          }
        } catch (prodError) {
          console.error(`Error creating product ${product.name}:`, prodError);
          results.push({
            type: "product",
            success: false,
            name: product.name,
            error: prodError instanceof Error ? prodError.message : "Unknown error"
          });
        }
      } catch (itemError) {
        console.error(`Error processing item at index ${i}:`, itemError);
        results.push({
          type: "error",
          index: i,
          error: itemError instanceof Error ? itemError.message : "Unknown error"
        });
      }
    }
    
    const successfulProducts = results.filter(r => r.type === "product" && r.success).length;
    const successfulInventory = results.filter(r => r.type === "inventory" && r.success).length;
    
    return createResponse(200, {
      message: `Successfully created ${successfulProducts} products and ${successfulInventory} inventory records`,
      productIds,
      details: results
    });
  } catch (error) {
    console.error("Error seeding mock data:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};