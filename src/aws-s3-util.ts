import { S3, PutObjectCommand, GetObjectCommand, PutObjectCommandOutput } from "@aws-sdk/client-s3";
import { S3BucketContentParams, S3BucketGetParams, S3BucketResponseParams } from "./types/s3bucket.js";
import dotenv from "dotenv";
import { Readable } from "stream";
dotenv.config();

const BUCKET: string = process.env.S3_BUCKET;

const s3 = new S3({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Upload file to S3 Bucket
export const uploadFileToS3 = async (key: string, content: string): Promise<PutObjectCommandOutput> => {
  const params: S3BucketContentParams = {
    Bucket: BUCKET,
    Key: key,
    Body: content,
  };

  try {
    const response: PutObjectCommandOutput = await s3.send(new PutObjectCommand(params));
    return response;
  } catch (error) {
    console.error(`Error uploading data to AWS S3 bucket`, error);
    throw error;
  }
};

// Download a file from S3 Bucket
export const downloadFileFromS3 = async (key: string): Promise<Readable> => {
  const params: S3BucketGetParams = {
    Bucket: BUCKET,
    Key: key,
  };

  try {
    const parameters = new GetObjectCommand(params);
    const s3result: S3BucketResponseParams = await s3.send(parameters);
    if (!s3result.Body || !(s3result.Body instanceof Readable)) throw new Error("No readable body in AWS s3 response!");
    return s3result.Body;
  } catch (error) {
    console.error(`Error downloading data from AWS S3 bucket!`, error);
    throw error;
  }
};
