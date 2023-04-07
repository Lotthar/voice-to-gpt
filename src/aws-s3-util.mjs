// Upload a file to S3
import { S3, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const BUCKET = process.env.S3_BUCKET;

const s3 = new S3({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const uploadFileToS3 = async (key, content) => {
  const params = {
    Bucket: BUCKET,
    Key: key,
    Body: content,
  };

  try {
    const response = await s3.send(new PutObjectCommand(params));
    return response;
  } catch (error) {
    console.error("Error uploading data to AWS S3 bucket:", error);
    throw error;
  }
};

// Download a file from S3
export const downloadFileFromS3 = async (key) => {
  const params = {
    Bucket: BUCKET,
    Key: key,
  };

  try {
    const response = await s3.send(new GetObjectCommand(params));
    return response.Body;
  } catch (error) {
    console.error("Error downloading data from AWS S3 bucket:", error);
    throw error;
  }
};
