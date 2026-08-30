import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 (S3-compatible) object storage for every uploaded file — photos,
 * prescriptions, diagnostic/coverage documents, community documents, marketplace
 * and catalog images, provider certifications.
 *
 * Why this exists: uploads used to be written with fs.writeFile to
 * public/uploads/** on local disk. public/uploads/** is git-ignored (only
 * .gitkeep placeholders are tracked), and Hostinger's autodeploy checks every
 * push out into a brand-new versioned build directory
 * (~/domains/eccare.in/.builds/versions/<uuid>/nodejs/) — so every deploy left
 * the running process pointed at a fresh directory with no uploaded files in it.
 * Every previously uploaded file became unreachable on the next deploy, for
 * every client (this was reported as "mobile photos not visible on web and vice
 * versa" — actually visible on neither, depending only on whether a deploy had
 * happened between upload and viewing). Object storage is independent of the
 * app server entirely, so this can't recur.
 */

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
// Public base URL for the bucket, no trailing slash — either the r2.dev public
// bucket URL (e.g. https://pub-xxxxxxxx.r2.dev) or a custom domain connected to
// the bucket. Stored file URLs are built as `${R2_PUBLIC_URL}/${key}`.
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

export function isStorageConfigured(): boolean {
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_URL);
}

// Instantiated lazily per call, not at module load — a client built at import
// time would capture env vars before they're actually set on this host, the
// same lazy-init bug already fixed once for the OpenAI/Anthropic/Claude clients
// elsewhere in this codebase (see lib/prescription-ai.ts, lib/quote-ai.ts).
function client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
  });
}

/** Uploads a file under `key` (e.g. "memories/<elderUserId>_<timestamp>.jpg")
 *  and returns its full public URL to store in the DB. Throws if storage isn't
 *  configured — callers should check isStorageConfigured() first and return a
 *  clean NOT_CONFIGURED error instead of letting this throw reach the client. */
export async function uploadToStorage(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!isStorageConfigured()) throw new Error('File storage is not configured.');
  await client().send(
    new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: body, ContentType: contentType }),
  );
  return `${R2_PUBLIC_URL}/${key}`;
}

/** Deletes the object backing a stored URL. Safe to call on a URL from before
 *  the R2 migration (a legacy "/uploads/..." local path) or when storage isn't
 *  configured — both are no-ops rather than errors, since there's nothing in
 *  R2 to clean up either way. */
export async function deleteFromStorage(url: string): Promise<void> {
  if (!isStorageConfigured() || !url.startsWith(`${R2_PUBLIC_URL}/`)) return;
  const key = url.slice(R2_PUBLIC_URL!.length + 1);
  await client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })).catch(() => {});
}
