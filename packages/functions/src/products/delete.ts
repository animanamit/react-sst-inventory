import { DynamoDBClient, DeleteItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamodb = new DynamoDBClient({});
const s3 = new S3Client({});

export const handler = async (event: any) => {
  try {
    const { id } = event.pathParameters;

    if (!id) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Product ID is required",
        }),
      };
    }

    // First, get the product to check if it has images to delete
    const getCommand = new GetItemCommand({
      TableName: process.env.PRODUCTS_TABLE,
      Key: marshall({
        productId: id,
      }),
    });

    const getResult = await dynamodb.send(getCommand);

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Product not found",
        }),
      };
    }

    const product = unmarshall(getResult.Item);

    // Delete any associated images from S3
    if (product.imageUrl && process.env.BUCKET_NAME) {
      try {
        // Extract the key from the image URL
        const url = new URL(product.imageUrl);
        const key = url.pathname.substring(1); // Remove leading slash

        const deleteObjectCommand = new DeleteObjectCommand({
          Bucket: process.env.BUCKET_NAME,
          Key: key,
        });

        await s3.send(deleteObjectCommand);
      } catch (s3Error) {
        console.warn("Failed to delete image from S3:", s3Error);
        // Continue with product deletion even if image deletion fails
      }
    }

    // Delete the product from DynamoDB
    const deleteCommand = new DeleteItemCommand({
      TableName: process.env.PRODUCTS_TABLE,
      Key: marshall({
        productId: id,
      }),
    });

    await dynamodb.send(deleteCommand);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Product deleted successfully",
        productId: id,
      }),
    };
  } catch (error) {
    console.error("Error deleting product:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to delete product",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};