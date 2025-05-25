import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamodb = new DynamoDBClient({});

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

    const command = new GetItemCommand({
      TableName: process.env.PRODUCTS_TABLE,
      Key: marshall({
        productId: id,
      }),
    });

    const result = await dynamodb.send(command);

    if (!result.Item) {
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

    const product = unmarshall(result.Item);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(product),
    };
  } catch (error) {
    console.error("Error getting product:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to get product",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};