// s3Types.ts
import { PutObjectCommandInput, GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { Readable } from "stream";

export type S3BucketContentParams = Omit<PutObjectCommandInput, "Body"> & {
  Body: string;
};

export type S3BucketGetParams = Omit<GetObjectCommandOutput, "Key" | "Bucket" | "$metadata"> & {
  Key: string;
  Bucket: string;
  $metadata?: GetObjectCommandOutput["$metadata"];
};

export type S3BucketResponseParams = {
  Body: Readable | ReadableStream<any> | Blob | undefined;
};
