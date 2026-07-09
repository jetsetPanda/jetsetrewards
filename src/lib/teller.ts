// Minimal Teller API client.
// - Sandbox: plain HTTPS with Basic auth (access token as username).
// - Development/Production: Teller requires mutual TLS; supply the client
//   certificate via TELLER_CERT_B64 / TELLER_KEY_B64 (base64-encoded PEMs).
// Must run in the Node.js runtime (uses node:https when mTLS is configured).

import https from "node:https";

export interface TellerAccount {
  id: string;
  name?: string;
  institution?: { name?: string };
  last_four?: string;
  type?: string;
  subtype?: string;
}

export interface TellerTransaction {
  id: string;
  account_id: string;
  amount: string; // signed decimal string
  date: string; // YYYY-MM-DD
  description: string;
  status: string; // posted | pending
}

// Overridable for local integration tests (point at a mock server).
const BASE = process.env.TELLER_API_BASE || "https://api.teller.io";

function basicAuth(accessToken: string): string {
  return "Basic " + Buffer.from(accessToken + ":").toString("base64");
}

function hasMtls(): boolean {
  return Boolean(process.env.TELLER_CERT_B64 && process.env.TELLER_KEY_B64);
}

function mtlsRequest(path: string, accessToken: string): Promise<unknown> {
  const cert = Buffer.from(process.env.TELLER_CERT_B64!, "base64");
  const key = Buffer.from(process.env.TELLER_KEY_B64!, "base64");
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.teller.io",
        path,
        method: "GET",
        cert,
        key,
        headers: { Authorization: basicAuth(accessToken) },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error("Teller: invalid JSON response"));
            }
          } else {
            reject(new Error(`Teller ${res.statusCode}: ${body.slice(0, 300)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function tellerGet(path: string, accessToken: string): Promise<unknown> {
  if (hasMtls()) {
    return mtlsRequest(path, accessToken);
  }
  const res = await fetch(BASE + path, {
    headers: { Authorization: basicAuth(accessToken) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Teller ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

export async function listAccounts(accessToken: string): Promise<TellerAccount[]> {
  return (await tellerGet("/accounts", accessToken)) as TellerAccount[];
}

export async function listTransactions(
  accessToken: string,
  accountId: string,
  count = 200
): Promise<TellerTransaction[]> {
  return (await tellerGet(
    `/accounts/${accountId}/transactions?count=${count}`,
    accessToken
  )) as TellerTransaction[];
}
