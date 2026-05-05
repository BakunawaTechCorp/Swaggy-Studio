import crypto from "node:crypto";

const VERSION = "v1";

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(value: string): string {
  const [version, ivRaw, tagRaw, encryptedRaw] = value.split(":");
  if (version !== VERSION || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Unsupported encrypted secret format.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivRaw, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function isEncryptedSecret(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(`${VERSION}:`);
}

function getKey(): Buffer {
  const secret =
    process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY ?? process.env.FACEBOOK_APP_SECRET;
  if (!secret) {
    throw new Error("FACEBOOK_TOKEN_ENCRYPTION_KEY or FACEBOOK_APP_SECRET is required.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}
