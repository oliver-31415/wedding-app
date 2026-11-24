import { createHash, randomBytes } from "node:crypto";

/** Short random id for database rows. */
export function newId(): string {
  return randomBytes(12).toString("base64url");
}

/** Unguessable token for cookies and links. Store only `hashToken(token)`. */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
