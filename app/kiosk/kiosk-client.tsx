"use client";

import { AlertTriangle, KeyRound, RefreshCw, ShieldCheck, TabletSmartphone, WifiOff } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { OperatorKioskView, type ActionRunner } from "../operation-modules";
import { EMPTY_SNAPSHOT, type Snapshot } from "../operations-dashboard";

const TOKEN_KEY = "factory-kiosk-device-token";
const SNAPSHOT_KEY = "factory-kiosk-last-snapshot";
const PROBE_KEY = "factory-kiosk-offline-test";

type KioskDevice = { id: string; name: string; plant: string; authorization_status: string };

function cachedSnapshot() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(window.localStorage.getItem(SNAPSHOT_KEY) ?? "null") as Snapshot | null; }
  catch { return null; }
}

export default function KioskClient() {
  const [token, setToken] = useState("");
  const [device, setDevice] = useState<KioskDevice | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [registrationCode, setRegistrationCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(true);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 4000);
  }, []);

  const loadSnapshot = useCallback(async (deviceToken: string) => {
    const response = await fetch("/api/kiosk", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${deviceToken}` },
    });
    const body = (await response.json()) as Snapshot & { device?: KioskDevice; error?: string };
    if (!response.ok) throw new Error(body.error ?? "Could not load kiosk assignments");
    setSnapshot(body);
    setDevice(body.device ?? null);
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(body));
    return body;
  }, []);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY) ?? "";
    const setConnection = () => setOnline(window.navigator.onLine);
    setConnection();
    window.addEventListener("online", setConnection);
    window.addEventListener("offline", setConnection);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    if (!storedToken) {
      queueMicrotask(() => setLoading(false));
      return () => {
        window.removeEventListener("online", setConnection);
        window.removeEventListener("offline", setConnection);
      };
    }
    queueMicrotask(() => {
      setToken(storedToken);
      void loadSnapshot(storedToken)
        .catch((loadError: unknown) => {
          const cache = cachedSnapshot();
          if (cache) {
            setSnapshot(cache);
            setDevice((cache as Snapshot & { device?: KioskDevice }).device ?? null);
            setError("Network unavailable. Showing the last synchronized assignments.");
          } else if (loadError instanceof Error && loadError.message.includes("not authorized")) {
            window.localStorage.removeItem(TOKEN_KEY);
            setToken("");
            setError("This kiosk authorization was removed. Enter a new activation code.");
          } else {
            setError(loadError instanceof Error ? loadError.message : "Could not start kiosk");
          }
        })
        .finally(() => setLoading(false));
    });
    return () => {
      window.removeEventListener("online", setConnection);
      window.removeEventListener("offline", setConnection);
    };
  }, [loadSnapshot]);

  const runAction = useCallback<ActionRunner>(async (payload) => {
    const response = await fetch("/api/kiosk", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as Record<string, unknown> & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "The kiosk could not synchronize");
    if (payload.action === "createEntry") await loadSnapshot(token);
    return result;
  }, [loadSnapshot, token]);

  async function activate(event: FormEvent) {
    event.preventDefault();
    setActivating(true);
    setError("");
    try {
      const response = await fetch("/api/kiosk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate", registrationCode }),
      });
      const result = (await response.json()) as { token?: string; kiosk?: KioskDevice; error?: string };
      if (!response.ok || !result.token) throw new Error(result.error ?? "Activation failed");
      window.localStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
      setDevice(result.kiosk ?? null);
      await loadSnapshot(result.token);
      notify("This physical kiosk is now authorized");
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : "Activation failed");
    } finally {
      setActivating(false);
    }
  }

  async function runOfflineTest() {
    const probe = { createdAt: new Date().toISOString(), deviceId: device?.id };
    window.localStorage.setItem(PROBE_KEY, JSON.stringify(probe));
    const recovered = window.localStorage.getItem(PROBE_KEY);
    if (!recovered) {
      notify("Offline storage test failed on this device");
      return;
    }
    try {
      const result = await runAction({ action: "recordOfflineTest" });
      window.localStorage.removeItem(PROBE_KEY);
      notify(`Offline storage and recovery test passed at ${new Date(String(result.testedAt)).toLocaleTimeString()}`);
    } catch {
      notify("Test saved locally. Reconnect and run it again to verify server recovery.");
    }
  }

  if (loading) return <main className="kiosk-activation"><section><RefreshCw className="spin" size={34} /><h1>Starting authorized kiosk…</h1></section></main>;

  if (!token) {
    return (
      <main className="kiosk-activation">
        <section>
          <span className="activation-icon"><TabletSmartphone size={38} /></span>
          <p className="eyebrow">Physical device authorization</p>
          <h1>Activate this kiosk</h1>
          <p>A supervisor must first register this machine from <b>Supervisor → Kiosk Devices</b>.</p>
          <form onSubmit={activate}>
            <label><KeyRound size={23} /><input autoFocus required maxLength={8} placeholder="8-character code" value={registrationCode} onChange={(event) => setRegistrationCode(event.target.value.toUpperCase())} /></label>
            <button className="kiosk-primary" disabled={activating}>{activating ? <RefreshCw className="spin" size={21} /> : <ShieldCheck size={21} />}Authorize device</button>
          </form>
          {error ? <span className="kiosk-error"><AlertTriangle size={18} />{error}</span> : null}
          <Link href="/">Return to workspace portal</Link>
        </section>
      </main>
    );
  }

  return (
    <>
      {!online || error ? <div className="kiosk-network-banner"><WifiOff size={18} />{!online ? "Offline mode: entries will stay safely on this kiosk." : error}</div> : null}
      <OperatorKioskView snapshot={snapshot} plantFilter={device?.plant ?? "All Plants"} onAction={runAction} notify={notify} deviceName={`${device?.name ?? "Authorized kiosk"} · ${device?.plant ?? ""}`} onOfflineTest={() => void runOfflineTest()} />
      {toast ? <div className="toast-message"><ShieldCheck size={18} />{toast}</div> : null}
    </>
  );
}
