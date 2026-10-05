"use client";

import { AlertTriangle, Download, Loader2, Play, Search, Square, Target } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_GROUPS, ALL_GROUP_IDS } from "@/lib/categories";
import { downloadText, leadsToCsv } from "@/lib/csv";
import { OPPORTUNITY_META, opportunity, websiteStatus } from "@/lib/leads";
import type { AuditResult, CategoryGroupId, GeocodeResult, GeoPoint, Lead, SearchResponse, WebsiteStatus } from "@/lib/types";
import { LeadDrawer } from "./LeadDrawer";
import { LeadsTable, type LeadRow } from "./LeadsTable";
import { SearchPanel, type SearchSettings } from "./SearchPanel";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-slate-100 text-sm text-slate-400">Chargement de la carte…</div>,
});

const STORAGE_KEY = "leadgen:v1";
const AUDIT_CONCURRENCY = 4;

type StatusFilter = "all" | "hot" | WebsiteStatus;
type SortKey = "opportunity" | "distance" | "name" | "score";

interface Saved {
  center: GeocodeResult | null;
  settings: SearchSettings;
  leads: Lead[];
  warnings: string[];
  audits: Record<string, AuditResult>;
}

const DEFAULT_SETTINGS: SearchSettings = {
  radius: 1000,
  groups: ALL_GROUP_IDS.filter((g) => g !== "auto"),
  source: "osm",
  excludeChains: true,
  autoAudit: true,
};

function loadSaved(): Partial<Saved> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Saved>) : null;
  } catch {
    return null;
  }
}

export default function LeadFinder() {
  const [config, setConfig] = useState({ google: false, pagespeedKey: false });
  const [center, setCenter] = useState<GeocodeResult | null>(null);
  const [settings, setSettings] = useState<SearchSettings>(DEFAULT_SETTINGS);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [audits, setAudits] = useState<Record<string, AuditResult>>({});
  const [auditing, setAuditing] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState<CategoryGroupId | "all">("all");
  const [text, setText] = useState("");
  const [sort, setSort] = useState<SortKey>("opportunity");
  const auditRun = useRef(0);
  const hydrated = useRef(false);

  // Restore the last session (client only, after mount, to avoid hydration mismatches).
  useEffect(() => {
    const saved = loadSaved();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from localStorage */
    if (saved) {
      if (saved.center) setCenter(saved.center);
      if (saved.settings) setSettings({ ...DEFAULT_SETTINGS, ...saved.settings });
      if (saved.leads?.length) {
        setLeads(saved.leads);
        setSearchedOnce(true);
      }
      if (saved.warnings) setWarnings(saved.warnings);
      if (saved.audits) setAudits(saved.audits);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    hydrated.current = true;
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const id = setTimeout(() => {
      try {
        const urls = new Set(leads.map((l) => l.website));
        const kept = Object.fromEntries(Object.entries(audits).filter(([url]) => urls.has(url)));
        const data: Saved = { center, settings, leads, warnings, audits: kept };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        /* quota exceeded or storage disabled: persistence is best-effort */
      }
    }, 500);
    return () => clearTimeout(id);
  }, [center, settings, leads, warnings, audits]);

  const auditOne = useCallback(async (url: string, force = false) => {
    setAuditing((s) => new Set(s).add(url));
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, force }),
      });
      const data = await res.json();
      if (res.ok) setAudits((a) => ({ ...a, [url]: data as AuditResult }));
    } catch {
      /* network hiccup: the lead simply stays "pending" and can be re-audited */
    } finally {
      setAuditing((s) => {
        const next = new Set(s);
        next.delete(url);
        return next;
      });
    }
  }, []);

  /** Audits a batch of websites with a small worker pool. Starting a new batch cancels the previous one. */
  const runAudits = useCallback(
    async (urls: string[]) => {
      const token = ++auditRun.current;
      const queue = Array.from(new Set(urls));
      const total = queue.length;
      if (!total) return;
      let done = 0;
      setProgress({ done, total });
      const worker = async () => {
        while (queue.length && auditRun.current === token) {
          await auditOne(queue.shift()!);
          done++;
          if (auditRun.current === token) setProgress({ done, total });
        }
      };
      await Promise.all(Array.from({ length: AUDIT_CONCURRENCY }, worker));
      if (auditRun.current === token) setProgress(null);
    },
    [auditOne],
  );

  const stopAudits = () => {
    auditRun.current++;
    setProgress(null);
  };

  async function search() {
    if (!center) return;
    stopAudits();
    setSearching(true);
    setError(null);
    setSelectedId(null);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: center.lat,
          lon: center.lon,
          radius: settings.radius,
          groups: settings.groups,
          source: settings.source,
          excludeChains: settings.excludeChains,
          locality: center.locality,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      const result = data as SearchResponse;
      setLeads(result.leads);
      setWarnings(result.warnings);
      setSearchedOnce(true);
      setStatusFilter("all");
      setGroupFilter("all");
      if (settings.autoAudit) {
        void runAudits(result.leads.flatMap((l) => (l.website && !audits[l.website] ? [l.website] : [])));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function pickCenter(p: GeoPoint) {
    setCenter({ ...p, label: `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`, locality: "" });
    const res = await fetch(`/api/geocode?lat=${p.lat}&lon=${p.lon}`).catch(() => null);
    const data = res?.ok ? await res.json() : null;
    const found = data?.results?.[0] as GeocodeResult | undefined;
    if (found) setCenter({ ...found, lat: p.lat, lon: p.lon });
  }

  const rows: LeadRow[] = useMemo(
    () =>
      leads.map((lead) => {
        const audit = lead.website ? audits[lead.website] : undefined;
        const status = websiteStatus(lead, audit, lead.website ? auditing.has(lead.website) : false);
        return { lead, status, audit, opportunity: opportunity(status) };
      }),
    [leads, audits, auditing],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, hot: 0 };
    for (const r of rows) {
      c[r.status] = (c[r.status] ?? 0) + 1;
      if (r.opportunity === "hot") c.hot++;
    }
    c.pending = (c.pending ?? 0) + (c.auditing ?? 0);
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = text.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (statusFilter === "hot" && r.opportunity !== "hot") return false;
      if (statusFilter === "pending" && r.status !== "pending" && r.status !== "auditing") return false;
      if (statusFilter !== "all" && statusFilter !== "hot" && statusFilter !== "pending" && r.status !== statusFilter) return false;
      if (groupFilter !== "all" && r.lead.group !== groupFilter) return false;
      if (q && !`${r.lead.name} ${r.lead.category} ${r.lead.address ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const score = (r: LeadRow) => (r.audit?.reachable && r.audit.checks.length ? r.audit.score : r.lead.website ? 50 : -1);
    return filtered.sort((a, b) => {
      switch (sort) {
        case "distance":
          return a.lead.distance - b.lead.distance;
        case "name":
          return a.lead.name.localeCompare(b.lead.name, "pt");
        case "score":
          return score(a) - score(b);
        default:
          return (
            OPPORTUNITY_META[a.opportunity].rank - OPPORTUNITY_META[b.opportunity].rank ||
            score(a) - score(b) ||
            a.lead.distance - b.lead.distance
          );
      }
    });
  }, [rows, statusFilter, groupFilter, text, sort]);

  const mapItems = useMemo(() => visible.map(({ lead, status }) => ({ lead, status })), [visible]);
  const selectedRow = rows.find((r) => r.lead.id === selectedId) ?? null;
  const pendingUrls = leads.flatMap((l) => (l.website && !audits[l.website] && !auditing.has(l.website) ? [l.website] : []));

  const exportCsv = () => {
    const date = new Date().toISOString().slice(0, 10);
    const place = (center?.locality || "portugal").toLowerCase().replace(/[^a-z0-9]+/gi, "-");
    downloadText(`leads-${place}-${date}.csv`, leadsToCsv(visible.map((r) => r.lead), audits));
  };

  const filterChips: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "hot", label: "🔥 Leads chauds" },
    { key: "none", label: "Sans site" },
    { key: "social", label: "Réseaux seulement" },
    { key: "redo", label: "À refaire" },
    { key: "improve", label: "Améliorable" },
    { key: "good", label: "Correct" },
    { key: "unknown", label: "Non analysable" },
    { key: "pending", label: "En attente" },
  ];

  return (
    <div className="flex h-dvh flex-col bg-slate-50 text-slate-900">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <div className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white">
          <Target className="size-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">LeadGen Portugal</h1>
          <p className="text-xs text-slate-500">Commerces sans site ou avec un site à refaire</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <aside className="w-full shrink-0 border-b border-slate-200 bg-white p-4 lg:w-[360px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <SearchPanel
            center={center}
            onCenter={setCenter}
            settings={settings}
            onSettings={setSettings}
            googleEnabled={config.google}
            searching={searching}
            onSearch={search}
          />

          {error && (
            <div className="mt-4 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}

          {leads.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {(
                [
                  ["all", "Commerces", "text-slate-900"],
                  ["hot", "Leads chauds", "text-red-600"],
                  ["none", "Sans site", "text-red-600"],
                  ["social", "Réseaux seulement", "text-orange-600"],
                  ["redo", "Site à refaire", "text-rose-700"],
                  ["improve", "Améliorable", "text-amber-600"],
                ] as const
              ).map(([key, label, color]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`rounded-lg border p-2.5 text-left transition hover:border-indigo-300 ${
                    statusFilter === key ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className={`text-xl font-bold tabular-nums ${color}`}>{counts[key] ?? 0}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </button>
              ))}
            </div>
          )}

          {warnings.map((w) => (
            <p key={w} className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
              {w}
            </p>
          ))}
        </aside>

        <main className="flex h-[90dvh] min-w-0 shrink-0 flex-col lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink">
          <div className="h-[38vh] min-h-[240px] shrink-0 border-b border-slate-200">
            <MapView
              center={center}
              radius={settings.radius}
              items={mapItems}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onPickCenter={pickCenter}
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Filtrer…"
                className="w-40 rounded-md border border-slate-300 py-1 pl-7 pr-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value as CategoryGroupId | "all")}
              className="rounded-md border border-slate-300 bg-white py-1 pl-2 pr-6 text-sm"
            >
              <option value="all">Toutes catégories</option>
              {CATEGORY_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-slate-300 bg-white py-1 pl-2 pr-6 text-sm"
            >
              <option value="opportunity">Tri : opportunité</option>
              <option value="score">Tri : score du site</option>
              <option value="distance">Tri : distance</option>
              <option value="name">Tri : nom</option>
            </select>

            <div className="ml-auto flex items-center gap-2">
              {progress ? (
                <>
                  <span className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Loader2 className="size-3.5 animate-spin" />
                    Analyse des sites {progress.done}/{progress.total}
                  </span>
                  <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 sm:block">
                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                  </div>
                  <button
                    type="button"
                    onClick={stopAudits}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
                  >
                    <Square className="size-3" /> Stop
                  </button>
                </>
              ) : (
                pendingUrls.length > 0 && (
                  <button
                    type="button"
                    onClick={() => runAudits(pendingUrls)}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700"
                  >
                    <Play className="size-3" /> Analyser {pendingUrls.length} site{pendingUrls.length > 1 ? "s" : ""}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={exportCsv}
                disabled={!visible.length}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="size-3.5" /> CSV ({visible.length})
              </button>
            </div>

            {leads.length > 0 && (
              <div className="flex w-full flex-wrap gap-1">
                {filterChips.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      statusFilter === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {label} <span className="opacity-60">{counts[key] ?? 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-white">
            {searching ? (
              <div className="flex h-full items-center justify-center gap-2 p-10 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" /> Recherche des commerces…
              </div>
            ) : leads.length ? (
              <LeadsTable rows={visible} selectedId={selectedId} onSelect={setSelectedId} />
            ) : (
              <div className="mx-auto max-w-md p-10 text-center text-sm text-slate-500">
                {searchedOnce ? (
                  "Aucun commerce trouvé dans cette zone. Essayez un rayon plus grand ou d'autres catégories."
                ) : (
                  <>
                    <p className="mb-2 text-base font-semibold text-slate-800">Trouvez vos prochains clients</p>
                    Choisissez un lieu au Portugal et un rayon : l&apos;outil liste les commerces, indique ceux qui n&apos;ont pas de
                    site web et analyse les autres pour repérer les sites à refaire ou à améliorer.
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedRow && (
        <LeadDrawer
          key={selectedRow.lead.id}
          row={selectedRow}
          locality={center?.locality}
          onClose={() => setSelectedId(null)}
          onReaudit={(url) => {
            setAudits((a) => {
              const next = { ...a };
              delete next[url];
              return next;
            });
            void auditOne(url, true);
          }}
        />
      )}
    </div>
  );
}
