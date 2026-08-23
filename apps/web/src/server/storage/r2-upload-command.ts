import { PutObjectCommand } from "@aws-sdk/client-s3";
import { isValidUploadSize } from "@/lib/uploads/upload-limits";

export function createBoundedUploadCommand(params: {
  bucket: string;
  key: string;
  contentType: string;
  contentLength: number;
}): PutObjectCommand {
  if (!isValidUploadSize(params.contentLength)) {
    throw new RangeError("Tamanho do upload deve estar entre 1 byte e 20 MB");
  }

  return new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  });
}
