import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// Initialize SQS client
const sqsClient = new SQSClient({
  // Enable local development mode if needed
  ...(process.env.NODE_ENV === "development" && {
    endpoint: "http://localhost:4566", // LocalStack endpoint
    region: "localhost",
    credentials: {
      accessKeyId: "local",
      secretAccessKey: "local",
    },
  }),
});

/**
 * Sends a message to an SQS queue
 * @param queueUrl The URL of the SQS queue
 * @param messageBody The message body to send
 * @param messageGroupId The message group ID for FIFO queues
 * @param deduplicationId Optional deduplication ID for FIFO queues
 * @returns Promise with the message ID and sequence number
 */
export async function sendSqsMessage<T = any>(
  queueUrl: string, 
  messageBody: T, 
  messageGroupId: string,
  deduplicationId?: string
) {
  if (!queueUrl) {
    throw new Error("Queue URL is required");
  }

  // Check if this is a FIFO queue
  const isFifoQueue = queueUrl.endsWith(".fifo");

  try {
    // Create the parameters for sending message
    const params = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody),
      // Add FIFO queue specific attributes if needed
      ...(isFifoQueue && {
        MessageGroupId: messageGroupId,
        // Use provided deduplicationId or generate based on content
        MessageDeduplicationId: deduplicationId || Date.now().toString(),
      }),
    };

    // Send the message
    const command = new SendMessageCommand(params);
    const response = await sqsClient.send(command);

    return {
      messageId: response.MessageId,
      sequenceNumber: response.SequenceNumber,
    };
  } catch (error) {
    console.error("Error sending message to SQS:", error);
    throw new Error(
      error instanceof Error
        ? `SQS send operation failed: ${error.message}`
        : "Unknown SQS error occurred"
    );
  }
}

/**
 * Helper function to wrap SQS operations with proper error handling
 */
export async function handleSqsError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error("SQS operation failed:", error);
    throw new Error(
      error instanceof Error
        ? `SQS operation failed: ${error.message}`
        : "Unknown SQS error occurred"
    );
  }
}