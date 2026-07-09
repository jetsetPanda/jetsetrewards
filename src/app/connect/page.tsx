"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

declare global {
  interface Window {
    TellerConnect?: {
      setup: (options: Record<string, unknown>) => { open: () => void };
    };
  }
}

export default function ConnectPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const connectRef = useRef<{ open: () => void } | null>(null);

  const appId = process.env.NEXT_PUBLIC_TELLER_APP_ID;
  const env = process.env.NEXT_PUBLIC_TELLER_ENV || "sandbox";

  function initialize() {
    if (!window.TellerConnect || !appId) return;
    connectRef.current = window.TellerConnect.setup({
      applicationId: appId,
      environment: env,
      products: ["transactions"],
      onSuccess: async (enrollment: {
        accessToken: string;
        enrollment: { id: string; institution?: { name?: string } };
      }) => {
        setStatus("Saving enrollment…");
        const res = await fetch("/api/teller/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(enrollment),
        });
        if (res.ok) {
          router.push("/wallet");
          router.refresh();
        } else {
          setStatus("Failed to save enrollment — check server logs.");
        }
      },
      onExit: () => setStatus(null),
    });
    setReady(true);
  }

  useEffect(() => {
    // If the script loaded before this component mounted
    if (window.TellerConnect) initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!appId) {
    return (
      <div className="panel mt-12 text-center text-sm text-slate-400">
        Set <code className="text-accent">NEXT_PUBLIC_TELLER_APP_ID</code> in
        your environment to enable bank linking.
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-md">
      <Script
        src="https://cdn.teller.io/connect/connect.js"
        onLoad={initialize}
      />
      <div className="panel text-center">
        <h1 className="text-lg font-semibold text-slate-100">Link a bank</h1>
        <p className="mt-2 text-sm text-slate-400">
          Read-only access via Teller. Your credentials are never stored by
          this app — the connection uses your bank&apos;s own login, and this
          app only ever receives transaction data.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Environment: <span className="text-accent">{env}</span>
        </p>
        <button
          className="btn-primary mt-6 w-full disabled:opacity-50"
          disabled={!ready}
          onClick={() => connectRef.current?.open()}
        >
          {ready ? "Open Teller Connect" : "Loading…"}
        </button>
        {status && <p className="mt-3 text-sm text-slate-400">{status}</p>}
      </div>
    </div>
  );
}
