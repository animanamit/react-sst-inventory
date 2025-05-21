import { APIGatewayProxyHandler } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createResponse, createErrorResponse } from "../utils/dynamodb";
import { ulid } from "ulid";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Check if there are query parameters
    if (!event.queryStringParameters) {
      return createErrorResponse(400, "Missing query parameters");
    }

    // Get the file name and content type from query parameters
    const { fileName, contentType } = event.queryStringParameters;

    if (!fileName) {
      return createErrorResponse(400, "Missing fileName parameter");
    }

    if (!contentType) {
      return createErrorResponse(400, "Missing contentType parameter");
    }

    // Generate a unique key for the S3 object
    // Format: {timestamp}-{randomId}-{originalFileName}
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueKey = `${Date.now()}-${ulid()}-${safeFileName}`;

    // Create an S3 client
    const s3Client = new S3Client({});

    // Get the bucket name from environment variables
    const bucketName = process.env.BUCKET_NAME;
    console.log("Bucket name from env:", bucketName);
    
    if (!bucketName) {
      return createErrorResponse(500, "Bucket name not configured");
    }
    
    // Create command for S3 PutObject operation
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueKey,
      ContentType: contentType,
      // Allow public read access if your bucket is configured for it
      ACL: "public-read",
    });

    // Generate a presigned URL for uploading the file
    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // URL expires in 1 hour
    });

    // Return the signed URL to the client
    return createResponse(200, {
      uploadUrl: signedUrl,
      // The URL where the file will be accessible after upload (without query parameters)
      fileUrl: `https://${bucketName}.s3.amazonaws.com/${uniqueKey}`,
    });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Error generating signed URL"
    );
  }
};