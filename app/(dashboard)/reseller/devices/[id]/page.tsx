"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Power,
  Trash2,
  Users,
  Ban,
  Unplug,
  RefreshCw,
} from "lucide-react";
import { resellerJson } from "@/lib/reseller-fetch";

type Site = { id: string; name: string };
type DeviceDetail = {
  id: string;
  name: string;
  mac: string;
  type: string;
  status: string;
  model: string | null;
  firmwareVersion: string | null;
  ip: string | null;
  lastSeen: string | null;
  site: { id: string; name: string; omadaSiteId: string | null } | null;
  live: {
    liveStatus?: string;
    clients?: number;
    uptime?: number;
    cpuUsage?: number;
    memUsage?: number;
  } | null;
};

export default function ResellerDeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [tab, setTab] = useState<"overview" | "clients">("overview");
  const [clients, setClients] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadDevice = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const r = await resellerJson<DeviceDetail>(`/api/v1/reseller/devices/${id}`);
    if (!r.ok) {
      setErr(r.error || "Not found");
      setLoading(false);
      return;
    }
    setDevice(r.data!);
    setSiteId(r.data!.site?.id || "");
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadDevice();
  }, [loadDevice]);

  useEffect(() => {
    (async () => {
      const r = await resellerJson<Site[]>("/api/v1/reseller/sites");
      if (r.ok && r.data) setSites(r.data);
    })();
  }, []);

  const loadClients = useCallback(async () => {
    setClientsLoading(true);
    setErr(null);
    const r = await resellerJson<{ clients: Record<string, unknown>[] }>(`/api/v1/reseller/devices/${id}/clients`);
    if (!r.ok) {
      setErr(r.error || "Could not load clients");
      setClients([]);
    } else {
      setClients((r.data!.clients || []) as Record<string, unknown>[]);
    }
    setClientsLoading(false);
  }, [id]);

  useEffect(() => {
    if (tab === "clients") void loadClients();
  }, [tab, loadClients]);

  async function patch(action?: string, body?: Record<string, unknown>) {
    setBusy(action || "patch");
    setMsg(null);
    setErr(null);
    const res = await fetch(`/api/v1/reseller/devices/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify(body || { action }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setErr(json.error || "Request failed");
      return;
    }
    setMsg(json.data?.message || "Done");
    if (action === "forget") {
      router.push("/reseller/devices");
      return;
    }
    void loadDevice();
  }

  async function clientAction(action: "block" | "disconnect", clientMac: string) {
    setBusy(clientMac + action);
    setErr(null);
    const res = await fetch(`/api/v1/reseller/devices/${id}/clients`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("ssdomada_token") || ""}`,
      },
      body: JSON.stringify({ action, clientMac }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) setErr(json.error || "Failed");
    else {
      setMsg(json.data?.message || "OK");
      void loadClients();
    }
  }

  function fmtUptime(sec: number) {
    if (!sec) return "—";
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-onyx-400 py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
        Loading device…
      </div>
    );
  }
  if (err && !device) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{err}</div>
        <Link href="/reseller/devices" className="text-gold text-sm font-semibold inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to devices
        </Link>
      </div>
    );
  }
  if (!device) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/reseller/devices"
            className="text-xs font-semibold text-gold hover:underline inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3 h-3" /> Devices
          </Link>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{device.name}</h1>
          <p className="text-onyx-400 font-mono text-sm mt-1">{device.mac}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => {
              if (!confirm("Send reboot command to this device via Omada?")) return;
              void patch("reboot");
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 disabled:opacity-40"
          >
            <Power className="w-4 h-4" />
            Reboot
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => {
              if (!confirm("Remove this device from your account?")) return;
              void patch("forget");
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </button>
        </div>
      </div>

      {(msg || err) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            err ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {err || msg}
        </div>
      )}

      <div className="flex gap-2 border-b border-white/10 pb-1">
        {(["overview", "clients"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setErr(null);
              setTab(t);
            }}
            className={`px-4 py-2 rounded-t-lg text-sm font-bold capitalize transition-colors ${
              tab === t ? "bg-gold-10 text-gold border border-b-0 border-gold-20" : "text-onyx-400 hover:text-white"
            }`}
          >
            {t === "clients" ? "Connected clients" : t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/10 bg-onyx-900/50 p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-onyx-500">Status</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-onyx-500 text-xs">DB status</div>
                <div className="font-bold text-white">{device.status}</div>
              </div>
              {device.live?.liveStatus && (
                <div>
                  <div className="text-onyx-500 text-xs">Live (Omada)</div>
                  <div className="font-bold text-gold">{device.live.liveStatus}</div>
                </div>
              )}
              <div>
                <div className="text-onyx-500 text-xs">Model</div>
                <div className="text-white">{device.model || "—"}</div>
              </div>
              <div>
                <div className="text-onyx-500 text-xs">Firmware</div>
                <div className="text-white">{device.firmwareVersion || "—"}</div>
              </div>
              <div>
                <div className="text-onyx-500 text-xs">IP</div>
                <div className="font-mono text-onyx-200">{device.ip || "—"}</div>
              </div>
              <div>
                <div className="text-onyx-500 text-xs">Last seen</div>
                <div className="text-onyx-200">
                  {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : "—"}
                </div>
              </div>
              {device.live?.uptime != null && (
                <div className="col-span-2">
                  <div className="text-onyx-500 text-xs">Uptime (controller)</div>
                  <div className="text-white">{fmtUptime(Number(device.live.uptime))}</div>
                </div>
              )}
              {device.live?.clients != null && (
                <div className="col-span-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-gold" />
                  <span className="text-white font-bold">{device.live.clients}</span>
                  <span className="text-onyx-500 text-xs">clients on this AP (Omada)</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-onyx-900/50 p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-onyx-500">Assign site</h2>
            <p className="text-xs text-onyx-500">
              Site must be linked to Omada for live stats, reboot, and client tools.
            </p>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-onyx-950 px-3 py-2 text-sm"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!!busy || !siteId || siteId === device.site?.id}
              onClick={() => void patch(undefined, { siteId })}
              className="w-full rounded-xl bg-gold py-2.5 text-sm font-bold text-onyx-950 disabled:opacity-40"
            >
              Save assignment
            </button>
          </div>
        </div>
      )}

      {tab === "clients" && (
        <div className="rounded-2xl border border-white/10 bg-onyx-900/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-bold text-white">Live clients (Omada)</span>
            <button
              type="button"
              onClick={() => void loadClients()}
              className="text-xs font-semibold text-gold inline-flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${clientsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          {clientsLoading ? (
            <div className="py-16 flex justify-center text-onyx-400">
              <Loader2 className="w-6 h-6 animate-spin text-gold" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-onyx-500 border-b border-white/5">
                    <th className="px-4 py-2">Client</th>
                    <th className="px-4 py-2">MAC</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-onyx-500">
                        No clients on this AP, or Omada link unavailable.
                      </td>
                    </tr>
                  ) : (
                    clients.map((c, i) => {
                      const mac = String(c.mac || c.clientMac || c.apMac || "");
                      const name = String(c.name || c.hostname || c.hostName || c.clientName || "Client");
                      return (
                        <tr key={`${mac}-${i}`}>
                          <td className="px-4 py-2 text-white">{name}</td>
                          <td className="px-4 py-2 font-mono text-xs text-onyx-400">{mac || "—"}</td>
                          <td className="px-4 py-2 text-right space-x-2">
                            <button
                              type="button"
                              disabled={!!busy || !mac}
                              onClick={() => void clientAction("disconnect", mac)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300 hover:underline disabled:opacity-40"
                            >
                              <Unplug className="w-3 h-3" />
                              Kick
                            </button>
                            <button
                              type="button"
                              disabled={!!busy || !mac}
                              onClick={() => void clientAction("block", mac)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-red-300 hover:underline disabled:opacity-40"
                            >
                              <Ban className="w-3 h-3" />
                              Block
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
