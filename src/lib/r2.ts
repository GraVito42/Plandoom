import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

const endpoint = `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

const baseConfig = {
  region: "auto",
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? "",
  },
}

// Client per il bucket immagini OCR (plandoom-seendo-reading)
const readingClient = new S3Client(baseConfig)

// Client per il bucket file allegati agli eventi (plandoom-seendo-storage)
const storageClient = new S3Client(baseConfig)

export async function uploadToReading(
  file: Buffer,
  key: string,
  contentType: string,
): Promise<{ url: string; sizeBytes: number }> {
  await readingClient.send(
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_READING_BUCKET ?? "",
      Key: key,
      Body: file,
      ContentType: contentType,
    }),
  )
  return {
    url: `${process.env.CLOUDFLARE_R2_READING_PUBLIC_URL ?? ""}/${key}`,
    sizeBytes: file.length,
  }
}

export async function uploadToStorage(
  file: Buffer,
  key: string,
  contentType: string,
): Promise<{ url: string; sizeBytes: number }> {
  await storageClient.send(
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_STORAGE_BUCKET ?? "",
      Key: key,
      Body: file,
      ContentType: contentType,
    }),
  )
  return {
    url: `${process.env.CLOUDFLARE_R2_STORAGE_PUBLIC_URL ?? ""}/${key}`,
    sizeBytes: file.length,
  }
}

export async function deleteFromReading(key: string): Promise<void> {
  await readingClient.send(
    new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_READING_BUCKET ?? "",
      Key: key,
    }),
  )
}

export async function deleteFromStorage(key: string): Promise<void> {
  await storageClient.send(
    new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_STORAGE_BUCKET ?? "",
      Key: key,
    }),
  )
}
