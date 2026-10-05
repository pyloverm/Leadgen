"use client";

import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CATEGORY_GROUPS } from "@/lib/categories";
import { formatDistance } from "@/lib/geo";
import type { CategoryGroupId, GeocodeResult, Source } from "@/lib/types";

export interface SearchSettings {
  radius: number;
  groups: CategoryGroupId[];
  source: Source;
  excludeChains: boolean;
  autoAudit: boolean;
}

interface Props {
  center: GeocodeResult | null;
  onCenter: (c: GeocodeResult) => void;
  settings: SearchSettings;
  onSettings: (s: SearchSettings) => void;
  googleEnabled: boolean;
  searching: boolean;
  onSearch: () => void;
}

const RADIUS_STEPS = [100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000];

export function SearchPanel({ center, onCenter, settings, onSettings, googleEnabled, searching, onSearch }: Props) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<GeocodeResult[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const set = <K extends keyof SearchSettings>(key: K, value: SearchSettings[K]) => onSettings({ ...settings, [key]: value });

  async function geocode(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setGeocoding(true);
    setGeoError(null);
    setCandidates([]);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const results = data.results as GeocodeResult[];
      if (!results.length) setGeoError("Lieu introuvable au Portugal. Essayez « ville, région » ou des coordonnées.");
      else if (results.length === 1) onCenter(results[0]);
      else setCandidates(results);
    } catch (err) {
      setGeoError((err as Error).message || "Erreur de géocodage");
    } finally {
      setGeocoding(false);
    }
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    setGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`).catch(() => null);
        const data = res?.ok ? await res.json() : null;
        onCenter(data?.results?.[0] ?? { lat, lon, label: "Ma position", locality: "" });
        setGeocoding(false);
      },
      () => {
        setGeoError("Position indisponible");
        setGeocoding(false);
      },
    );
  }

  const radiusIndex = Math.max(0, RADIUS_STEPS.findIndex((r) => r >= settings.radius));
  const toggleGroup = (id: CategoryGroupId) =>
    set("groups", settings.groups.includes(id) ? settings.groups.filter((g) => g !== id) : [...settings.groups, id]);

  return (
    <div className="space-y-5">
      <section>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Lieu au Portugal</label>
        <form onSubmit={geocode} className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Lagos, Alfama Lisboa, 41.15,-8.61…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <button
            type="submit"
            disabled={geocoding}
            className="inline-flex items-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            aria-label="Chercher le lieu"
          >
            {geocoding ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          </button>
          <button
            type="button"
            onClick={locateMe}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2.5 text-slate-600 hover:bg-slate-50"
            title="Utiliser ma position"
          >
            <Crosshair className="size-4" />
          </button>
        </form>
        {geoError && <p className="mt-1.5 text-xs text-rose-600">{geoError}</p>}
        {candidates.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
            {candidates.map((c) => (
              <li key={`${c.lat},${c.lon}`}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-indigo-50"
                  onClick={() => {
                    onCenter(c);
                    setCandidates([]);
                  }}
                >
                  <span className="font-medium text-slate-800">{c.label.split(",")[0]}</span>
                  <span className="block truncate text-xs text-slate-500">{c.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          {center ? (
            <>
              <span className="font-medium text-slate-800">Centre :</span> {center.label}
              <span className="block text-slate-400">
                {center.lat.toFixed(5)}, {center.lon.toFixed(5)} · cliquez sur la carte pour déplacer
              </span>
            </>
          ) : (
            "Cherchez un lieu ou cliquez directement sur la carte."
          )}
        </div>
      </section>

      <section>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rayon</label>
          <span className="text-sm font-semibold text-indigo-600">{formatDistance(settings.radius)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={RADIUS_STEPS.length - 1}
          value={radiusIndex}
          onChange={(e) => set("radius", RADIUS_STEPS[Number(e.target.value)])}
          className="w-full accent-indigo-600"
        />
        {settings.radius > 3000 && (
          <p className="mt-1 text-xs text-amber-600">Grand rayon : la recherche et les audits seront plus longs.</p>
        )}
      </section>

      <section>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Types de commerces</label>
          <button
            type="button"
            className="text-xs text-indigo-600 hover:underline"
            onClick={() =>
              set("groups", settings.groups.length === CATEGORY_GROUPS.length ? [] : CATEGORY_GROUPS.map((g) => g.id))
            }
          >
            {settings.groups.length === CATEGORY_GROUPS.length ? "Aucun" : "Tous"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_GROUPS.map((g) => {
            const active = settings.groups.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGroup(g.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                <span aria-hidden>{g.emoji}</span> {g.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Source des données</label>
        <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1 text-xs font-medium">
          {(
            [
              ["osm", "OpenStreetMap", "gratuit"],
              ["google", "Google Places", googleEnabled ? "clé configurée" : "clé requise"],
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              disabled={value === "google" && !googleEnabled}
              onClick={() => set("source", value)}
              title={value === "google" && !googleEnabled ? "Ajoutez GOOGLE_PLACES_API_KEY dans .env.local" : undefined}
              className={`rounded-md px-2 py-1.5 text-center disabled:cursor-not-allowed disabled:opacity-50 ${
                settings.source === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
              <span className="block text-[10px] font-normal text-slate-400">{hint}</span>
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={settings.excludeChains}
            onChange={(e) => set("excludeChains", e.target.checked)}
            className="size-4 accent-indigo-600"
          />
          Exclure les chaînes et enseignes
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={settings.autoAudit}
            onChange={(e) => set("autoAudit", e.target.checked)}
            className="size-4 accent-indigo-600"
          />
          Analyser les sites automatiquement
        </label>
      </section>

      <button
        type="button"
        onClick={onSearch}
        disabled={!center || searching || settings.groups.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        {searching ? "Recherche en cours…" : "Trouver les commerces"}
      </button>
    </div>
  );
}
