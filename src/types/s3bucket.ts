// s3Types.ts
import { PutObjectCommandInput, GetObjectCommandOutput, GetObjectCommandInput } from "@aws-sdk/client-s3";

export type S3BucketContentParams = Omit<PutObjectCommandInput, "Body"> & {
  Body: string;
};

export type S3BucketGetParams = Omit<GetObjectCommandOutput, "Key" | "Bucket" | "$metadata"> & {
  Key: string;
  Bucket: string;
  $metadata?: GetObjectCommandOutput["$metadata"];
};

export type S3BucketResponseParams = {
  Body: GetObjectCommandOutput["Body"];
};
