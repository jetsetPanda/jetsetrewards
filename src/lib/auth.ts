// Session auth for a single-user app.
// Uses only Web Crypto so it runs in both the Edge runtime (middleware)
// and the Node runtime (server actions).

export const SESSION_COOKIE = "jsr_auth";
const PAYLOAD = "jetsetrewards:session:v1";

async function hmacHex(value: string): Promise<string> {
  const secret = process.env.SESSION_SECRET || "";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(): Promise<string> {
  return hmacHex(PAYLOAD);
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  if (!process.env.SESSION_SECRET) return false;
  const expected = await hmacHex(PAYLOAD);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function checkPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD;
  return Boolean(expected) && password === expected;
}
