import { SQSEvent, SQSHandler, SQSRecord } from "aws-lambda";
import { PutCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { 
  dynamoDb, 
  handleDynamoError, 
  createResponse, 
  createErrorResponse 
} from "../utils/dynamodb";
import { 
  SQSMessageSchema, 
  AlertSchema, 
  AlertMessageSchema 
} from "../utils/types";
import { ulid } from "ulid";

/**
 * Handler for processing SQS messages from the alerts queue
 */
export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log(`Processing ${event.Records.length} SQS messages`);
  
  try {
    // Process each message in the batch
    const results = await Promise.allSettled(
      event.Records.map(record => processMessage(record))
    );
    
    // Log success and failure counts
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`Successfully processed ${succeeded} messages, failed to process ${failed} messages`);
    
    // If any message failed to process, throw an error to trigger SQS retry
    if (failed > 0) {
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason)
        .join(', ');
      
      throw new Error(`Failed to process ${failed} messages: ${errors}`);
    }
  } catch (error) {
    console.error("Error processing SQS batch:", error);
    throw error; // Re-throw to trigger SQS retry
  }
};

/**
 * Process a single SQS message
 */
async function processMessage(record: SQSRecord): Promise<any> {
  try {
    // Parse message body
    const body = JSON.parse(record.body);
    
    // Validate message format
    const message = SQSMessageSchema.parse(body);
    
    // Process based on message type
    switch (message.type) {
      case "ALERT_REQUEST":
        return processAlertRequest(message.payload);
      
      case "EMAIL_NOTIFICATION":
        // TODO: Implement email notification processing
        console.log("Email notification processing not yet implemented");
        return { status: "skipped", reason: "Email notifications not implemented yet" };
      
      default:
        // This should never happen due to zod validation
        console.warn(`Unknown message type: ${(message as any).type}`);
        return { status: "skipped", reason: "Unknown message type" };
    }
  } catch (error) {
    console.error("Error processing SQS message:", error);
    throw error;
  }
}

/**
 * Process an alert request from SQS
 */
async function processAlertRequest(payload: any): Promise<any> {
  try {
    // Check required environment variables
    if (!process.env.ALERTS_TABLE) {
      throw new Error("ALERTS_TABLE environment variable is not set");
    }
    
    // Check if product info is needed
    if (!process.env.PRODUCTS_TABLE) {
      console.warn("PRODUCTS_TABLE environment variable is not set, product details won't be included");
    }
    
    // Check if there's already an active alert for this product and location
    const existingAlertsParams = {
      TableName: process.env.ALERTS_TABLE,
      FilterExpression: "productId = :pid AND #status = :status",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":pid": payload.productId,
        ":status": "NEW"
      }
    };
    
    const existingAlertsResult = await dynamoDb.send(new ScanCommand(existingAlertsParams));
    const existingAlerts = existingAlertsResult.Items || [];
    
    if (existingAlerts.length > 0) {
      console.log(`Alert already exists for product ${payload.productId}, skipping creation`);
      return { status: "skipped", reason: "Alert already exists", alert: existingAlerts[0] };
    }
    
    // Get product information if available
    let productName = "Unknown Product";
    if (process.env.PRODUCTS_TABLE) {
      try {
        const productParams = {
          TableName: process.env.PRODUCTS_TABLE,
          Key: {
            productId: payload.productId,
          },
        };
        
        const productResult = await dynamoDb.send(new GetCommand(productParams));
        if (productResult.Item) {
          productName = productResult.Item.name || "Unknown Product";
        }
      } catch (error) {
        console.warn(`Could not fetch product details for ${payload.productId}:`, error);
      }
    }
    
    // Generate a unique ID for the alert
    const alertId = ulid();
    
    // Create the alert object
    const alertData = AlertSchema.parse({
      alertId,
      productId: payload.productId,
      locationId: payload.locationId,
      alertType: payload.alertType || "LOW",
      threshold: payload.minThreshold,
      currentStock: payload.currentStock,
      status: "NEW",
      createdAt: Date.now(),
      metadata: {
        productName,
        source: "sqs",
        requestId: payload.requestId,
      }
    });
    
    // Save the alert to DynamoDB
    const params = {
      TableName: process.env.ALERTS_TABLE,
      Item: alertData,
    };
    
    await dynamoDb.send(new PutCommand(params));
    
    console.log(`Created new alert ${alertId} for product ${payload.productId}`);
    
    // TODO: Add notification logic here (email, SMS, etc.)
    
    return { status: "created", alert: alertData };
  } catch (error) {
    console.error("Error processing alert request:", error);
    throw error;
  }
}