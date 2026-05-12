"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Search, Shield, Clock } from "lucide-react";
import { adminJson } from "@/lib/admin-fetch";

type Log = {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { name: string | null; email: string; role: string } | null;
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 40, total: 0 });
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(meta.page));
    q.set("limit", String(meta.limit));
    if (query.trim()) q.set("search", query.trim());
    const r = await adminJson<Log[]>(`/api/v1/admin/audit-logs?${q}`);
    if (!r.ok) setErr(r.error || "Failed");
    else {
      setLogs(r.data || []);
      if (r.meta) setMeta((m) => ({ ...m, ...r.meta! }));
    }
    setLoading(false);
  }, [meta.page, meta.limit, query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-black text-white md:text-4xl">Audit logs</h1>
        <p className="mt-1 text-onyx-400">Immutable trail of privileged actions (who / what / when / IP).</p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/30 via-transparent to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-gold-10 flex items-center justify-center">
              <Shield className="w-3 h-3 text-gold" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold-600-op">Total entries</span>
          </div>
          <div className="text-2xl font-black text-white">{meta.total}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center">
              <Clock className="w-3 h-3 text-sky-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Page</span>
          </div>
          <div className="text-2xl font-black text-white">{meta.page}<span className="text-sm text-onyx-400">/{Math.ceil(meta.total / meta.limit) || 1}</span></div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
              <Search className="w-3 h-3 text-amber-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-onyx-400">Showing</span>
          </div>
          <div className="text-2xl font-black text-white">{logs.length}</div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setQuery(search.trim());
                setMeta((m) => ({ ...m, page: 1 }));
              }
            }}
            placeholder="Search action, entity, IP…"
            className="w-full rounded-xl border border-gold-10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-onyx-500 focus:border-gold-30 focus:ring-1 focus:ring-gold/20 outline-none transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery(search.trim());
            setMeta((m) => ({ ...m, page: 1 }));
          }}
          className="rounded-xl border border-gold-30 bg-gold-10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all"
        >
          Search
        </button>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-gold-10 bg-gold-10 px-3 py-2.5 text-sm font-semibold text-gold hover:bg-gold-20 transition-all">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* ── Log entries ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="rounded-xl border border-gold-10 bg-gradient-to-br from-gold-5/10 via-transparent to-transparent px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-bold border bg-amber-500/10 text-amber-400 border-amber-500/15">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {l.action}
                </span>
                <span className="text-xs text-onyx-400">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
              <div className="mt-1.5 text-[11px] text-onyx-400 font-mono">
                {l.entity} {l.entityId ? <span className="text-onyx-300">· {l.entityId}</span> : ""} · {l.ipAddress || "no IP"} ·{" "}
                {l.user ? <span className="text-onyx-200">{l.user.email} ({l.user.role})</span> : "system"}
              </div>
            </div>
          ))}
          {logs.length === 0 && <p className="text-onyx-500">No entries.</p>}
          {meta.total > meta.limit && (
            <div className="flex items-center justify-between pt-4 text-xs text-onyx-400">
              <span>{meta.total} total · page {meta.page}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={meta.page <= 1}
                  onClick={() => setMeta((m) => ({ ...m, page: m.page - 1 }))}
                  className="rounded-lg border border-gold-10 px-3 py-1.5 hover:bg-gold-5 disabled:opacity-40 transition-colors"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={meta.page * meta.limit >= meta.total}
                  onClick={() => setMeta((m) => ({ ...m, page: m.page + 1 }))}
                  className="rounded-lg border border-gold-10 px-3 py-1.5 hover:bg-gold-5 disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
