# Testing Scripts

This directory contains utility scripts for testing various aspects of the application.

## SQS Testing

The `test-sqs.ts` script allows you to test the SQS integration by sending test messages to your configured queue.

### Prerequisites

- AWS credentials configured (either via environment variables, AWS config, or SST)
- Access to the SQS queue

### Running the Test

You can run the script using either of these methods:

**Using npx with ts-node:**

```bash
# From the project root directory
npx ts-node packages/functions/src/scripts/test-sqs.ts
```

**Using environment variables:**

```bash
# Set specific queue URL (useful for testing)
SQS_QUEUE_URL=https://sqs.ap-southeast-1.amazonaws.com/123456789012/AlertsQueue.fifo \
AWS_REGION=ap-southeast-1 \
npx ts-node packages/functions/src/scripts/test-sqs.ts
```

**Testing with LocalStack:**

If you're using LocalStack for local development:

```bash
USE_LOCALSTACK=true \
SQS_QUEUE_NAME=AlertsQueue.fifo \
npx ts-node packages/functions/src/scripts/test-sqs.ts
```

### Expected Output

If successful, you should see output similar to:

```
Found queue URL: https://sqs.ap-southeast-1.amazonaws.com/123456789012/AlertsQueue.fifo
Message sent successfully! { ... }
Message ID: a1b2c3d4-5678-90ab-cdef-EXAMPLE11111
Message content: {
  "type": "ALERT_REQUEST",
  "payload": {
    "productId": "test-product-1234",
    "locationId": "main",
    "currentStock": 5,
    "minThreshold": 10,
    "alertType": "LOW",
    "timestamp": 1621234567890,
    "requestId": "01GXX12345ABCDEFGHJKLMNOPQ"
  }
}
```

This confirms that the message was successfully sent to the queue. The SQS consumer Lambda function should then process this message according to its configuration.