/**
 * S3-compatible object storage for assets.
 * Uses SeaweedFS in dev, any S3-compatible service in production.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';
import { s3Config } from './config.js';

const s3 = new S3Client({
  endpoint: s3Config.endpoint,
  region: s3Config.region,
  credentials: {
    accessKeyId: s3Config.accessKeyId,
    secretAccessKey: s3Config.secretAccessKey,
  },
  forcePathStyle: true,
});

const BUCKET = s3Config.bucket;

/**
 * Ensure the storage bucket exists, creating it if needed.
 */
export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    console.log(`[Storage] Creating bucket: ${BUCKET}`);
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
  console.log(`[Storage] Bucket ready: ${BUCKET}`);
}

/**
 * Upload an object to S3.
 */
export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * Get an object from S3.
 */
export async function getObject(
  key: string
): Promise<{ body: Readable; contentType: string | undefined }> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );
  return {
    body: response.Body as Readable,
    contentType: response.ContentType,
  };
}

/**
 * Delete a single object from S3.
 */
export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Delete all objects matching a prefix.
 */
export async function deleteByPrefix(prefix: string): Promise<void> {
  const listResponse = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );

  const objects = listResponse.Contents;
  if (!objects || objects.length === 0) return;

  await s3.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: {
        Objects: objects.map((o) => ({ Key: o.Key })),
      },
    })
  );
}
