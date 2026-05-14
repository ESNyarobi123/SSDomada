"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Inbox,
  CheckCircle2,
  XCircle,
  Building2,
  Wifi,
  Router,
  ExternalLink,
  Copy,
} from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";
import type { PortalSetupSnapshot } from "@/lib/portal-setup-types";

type RequestRow = {
  id: string;
  status: "PENDING" | "DONE" | "DISMISSED";
  note: string | null;
  details: PortalSetupSnapshot;
  createdAt: string;
  resolvedAt: string | null;
  reseller: {
    id: string;
    companyName: string;
    brandSlug: string;
    user: { email: string; name: string | null };
  };
};

type ListPayload = {
  requests: RequestRow[];
  counts: { pending: number; done: number };
};

function copyText(text: string) {
  void navigator.clipboard.writeText(text).catch(() => {});
}

export default function SuperAdminPortalRequestsPage() {
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [data, setData] = useState<ListPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const q = filter === "PENDING" ? "?status=PENDING" : "";
    const r = await adminJson<ListPayload>(`/api/v1/admin/portal-setup-requests${q}`);
    if (!r.ok) {
      setErr(r.error || "Failed to load");
      setData(null);
      return;
    }
    setData(r.data ?? null);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: string, status: "DONE" | "DISMISSED") {
    setBusyId(id);
    const r = await adminJson<RequestRow>(`/api/v1/admin/portal-setup-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    if (!r.ok) {
      setErr(r.error || "Update failed");
      return;
    }
    await load();
  }

  if (err && !data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        {err}
        <p className="mt-2 text-sm text-onyx-400">Sign in as SUPER_ADMIN.</p>
      </div>
    );
  }

  const pending = data?.counts.pending ?? 0;
  const done = data?.counts.done ?? 0;
  const list = data?.requests ?? [];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Portal setup requests</h1>
          <p className="text-onyx-400 mt-1 text-sm md:text-base">
            Resellers ask here for manual Omada configuration. Use the cards when you open Omada Controller.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter("PENDING")}
            className={`rounded-xl px-4 py-2 text-sm font-bold border transition-all ${
              filter === "PENDING"
                ? "border-rose-400/50 bg-rose-500/20 text-rose-100"
                : "border-white/10 text-onyx-400 hover:border-white/20"
            }`}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`rounded-xl px-4 py-2 text-sm font-bold border transition-all ${
              filter === "ALL"
                ? "border-rose-400/50 bg-rose-500/20 text-rose-100"
                : "border-white/10 text-onyx-400 hover:border-white/20"
            }`}
          >
            All
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Inbox className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-200/80">Open queue</p>
            <p className="text-3xl font-black text-white">{pending}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-200/80">Completed (total)</p>
            <p className="text-3xl font-black text-white">{done}</p>
          </div>
        </div>
      </div>

      {!data ? (
        <div className="flex items-center gap-3 py-20 text-onyx-400">
          <Loader2 className="h-8 w-8 animate-spin text-rose-300" />
          Loading…
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-onyx-400">
          No requests in this view.
        </div>
      ) : (
        <ul className="space-y-5" role="list">
          {list.map((req) => (
            <li
              key={req.id}
              className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.06] bg-white/[0.02]">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-white truncate">{req.reseller.companyName}</p>
                  <p className="text-sm text-onyx-400 truncate">
                    {req.reseller.user.email}
                    {req.reseller.user.name ? ` · ${req.reseller.user.name}` : ""}
                  </p>
                  <p className="text-xs text-gold/90 mt-1 font-mono">/{req.reseller.brandSlug}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-bold uppercase px-2.5 py-1 rounded-lg ${
                      req.status === "PENDING"
                        ? "bg-amber-500/20 text-amber-200"
                        : req.status === "DONE"
                          ? "bg-emerald-500/20 text-emerald-200"
                          : "bg-onyx-600 text-onyx-300"
                    }`}
                  >
                    {req.status}
                  </span>
                  {req.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => void setStatus(req.id, "DONE")}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/90 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Done
                      </button>
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => void setStatus(req.id, "DISMISSED")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-onyx-300 hover:bg-white/5 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyText(req.details.portalUrl || "")}
                    className="inline-flex items-center gap-2 rounded-lg border border-gold-20 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/20"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy portal URL
                  </button>
                  {req.details.portalUrl ? (
                    <a
                      href={req.details.portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-onyx-200 hover:bg-white/5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open portal
                    </a>
                  ) : null}
                  <Link
                    href={`/super-admin/resellers/${req.reseller.id}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-onyx-200 hover:bg-white/5"
                  >
                    Reseller profile
                  </Link>
                </div>

                {req.note ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase text-onyx-500">Reseller message</p>
                    <p className="text-sm text-onyx-200 mt-1 whitespace-pre-wrap">{req.note}</p>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {req.details.sites.map((site) => (
                    <div
                      key={site.siteId}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3"
                    >
                      <div className="flex items-start gap-2">
                        <Building2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-white">{site.siteName}</p>
                          <p className="text-xs font-mono text-onyx-500 mt-0.5">
                            SSDomada site id: {site.siteId}
                            {site.omadaSiteId ? (
                              <>
                                {" "}
                                · Omada site id:{" "}
                                <button
                                  type="button"
                                  onClick={() => copyText(site.omadaSiteId || "")}
                                  className="text-gold hover:underline"
                                >
                                  {site.omadaSiteId}
                                </button>
                              </>
                            ) : (
                              <span className="text-amber-400/90"> · No Omada site id in SSDomada yet</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {site.ssids.length > 0 ? (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-onyx-500 flex items-center gap-1.5 mb-2">
                            <Wifi className="w-3 h-3" /> Wi‑Fi (SSID)
                          </p>
                          <ul className="space-y-1.5">
                            {site.ssids.map((s) => (
                              <li
                                key={s.id}
                                className="text-sm text-onyx-200 flex flex-wrap gap-x-3 gap-y-1 border-l-2 border-gold/30 pl-3"
                              >
                                <span className="font-semibold text-white">{s.ssidName}</span>
                                <span className="text-onyx-500">{s.open ? "Open" : "Secured"}</span>
                                <span className="text-onyx-500">{s.band}</span>
                                {s.omadaSsidId ? (
                                  <button
                                    type="button"
                                    onClick={() => copyText(s.omadaSsidId || "")}
                                    className="text-xs font-mono text-gold/90 hover:underline"
                                  >
                                    Omada SSID: {s.omadaSsidId}
                                  </button>
                                ) : (
                                  <span className="text-xs text-amber-300/90">No Omada SSID id in SSDomada</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-onyx-500">No SSIDs recorded for this location.</p>
                      )}

                      {site.devices.length > 0 ? (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-onyx-500 flex items-center gap-1.5 mb-2">
                            <Router className="w-3 h-3" /> Devices
                          </p>
                          <ul className="space-y-1.5">
                            {site.devices.map((d) => (
                              <li
                                key={d.id}
                                className="text-xs text-onyx-300 flex flex-wrap gap-x-3 gap-y-1 border-l-2 border-white/10 pl-3"
                              >
                                <span className="text-white font-medium">{d.name}</span>
                                <span className="font-mono">{d.mac}</span>
                                {d.model ? <span>{d.model}</span> : null}
                                <span>{d.status}</span>
                                {d.omadaDeviceId ? (
                                  <button
                                    type="button"
                                    onClick={() => copyText(d.omadaDeviceId || "")}
                                    className="text-gold/90 font-mono hover:underline"
                                  >
                                    Omada: {d.omadaDeviceId}
                                  </button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-onyx-500">No devices registered for this location.</p>
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-onyx-600">
                  Requested {new Date(req.createdAt).toLocaleString()}
                  {req.resolvedAt ? ` · Resolved ${new Date(req.resolvedAt).toLocaleString()}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
