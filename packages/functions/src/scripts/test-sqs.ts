/**
 * This is a script to test SQS functionality locally or in development
 * Do not use in production!
 */

import { SQSClient, SendMessageCommand, GetQueueUrlCommand } from "@aws-sdk/client-sqs";
import { AlertMessageSchema } from "../utils/types";
import { ulid } from "ulid";

const run = async () => {
  try {
    // Get the queue URL from environment or use a hardcoded test URL
    const queueName = process.env.SQS_QUEUE_NAME || "AlertsQueue.fifo";
    
    // Set up SQS client
    const sqsClient = new SQSClient({
      region: process.env.AWS_REGION || "ap-southeast-1",
      // If you're testing locally with LocalStack
      ...(process.env.USE_LOCALSTACK === "true" && {
        endpoint: "http://localhost:4566",
        credentials: {
          accessKeyId: "test",
          secretAccessKey: "test",
        },
      }),
    });

    // Get queue URL
    let queueUrl: string;
    try {
      const queueUrlResponse = await sqsClient.send(
        new GetQueueUrlCommand({ QueueName: queueName })
      );
      queueUrl = queueUrlResponse.QueueUrl!;
      console.log(`Found queue URL: ${queueUrl}`);
    } catch (error) {
      console.error(`Failed to get queue URL for ${queueName}:`, error);
      queueUrl = process.env.SQS_QUEUE_URL!;
      if (!queueUrl) {
        throw new Error("Queue URL not found and SQS_QUEUE_URL not set!");
      }
      console.log(`Using explicit queue URL: ${queueUrl}`);
    }

    // Create a test message
    const alertMessage = AlertMessageSchema.parse({
      type: "ALERT_REQUEST",
      payload: {
        productId: "test-product-" + Date.now().toString().slice(-4),
        locationId: "main",
        currentStock: 5,
        minThreshold: 10,
        alertType: "LOW",
        timestamp: Date.now(),
        requestId: ulid(),
      }
    });

    // Send message to queue
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(alertMessage),
      // FIFO queue specific attributes
      MessageGroupId: "test-group",
      MessageDeduplicationId: `test-${Date.now()}`,
    });

    const response = await sqsClient.send(command);
    console.log("Message sent successfully!", response);
    console.log("Message ID:", response.MessageId);
    console.log("Message content:", JSON.stringify(alertMessage, null, 2));

  } catch (error) {
    console.error("Error in SQS test script:", error);
  }
};

// Self-invoke if this script is run directly
if (require.main === module) {
  run().catch(console.error);
}

export { run };