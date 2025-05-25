import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamodb = new DynamoDBClient({});

export const handler = async (event: any) => {
  try {
    const { productId, locationId } = event.pathParameters;

    if (!productId || !locationId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "productId and locationId are required",
        }),
      };
    }

    const command = new GetItemCommand({
      TableName: process.env.INVENTORY_TABLE,
      Key: marshall({
        productId,
        locationId,
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
          error: "Inventory item not found",
        }),
      };
    }

    const item = unmarshall(result.Item);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(item),
    };
  } catch (error) {
    console.error("Error getting inventory item:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to get inventory item",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};