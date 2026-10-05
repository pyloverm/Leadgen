"use client";

import {
  Check,
  Copy,
  ExternalLink,
  Gauge,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { formatDistance } from "@/lib/geo";
import { googleSearchUrl } from "@/lib/leads";
import { buildPitch } from "@/lib/pitch";
import type { AuditCheck, PageSpeedResult } from "@/lib/types";
import { displayHost } from "@/lib/urls";
import type { LeadRow } from "./LeadsTable";
import { OpportunityTag, ScoreBar, StatusBadge } from "./StatusBadge";

interface Props {
  row: LeadRow;
  locality?: string;
  onClose: () => void;
  onReaudit: (url: string) => void;
}

const SEVERITY_LABEL: Record<AuditCheck["severity"], string> = {
  critical: "Critique",
  major: "Important",
  minor: "Mineur",
};

/** Portuguese mobile numbers (9xx xxx xxx) are usually on WhatsApp. */
function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  if (/^9\d{8}$/.test(digits)) return `351${digits}`;
  if (/^3519\d{8}$/.test(digits)) return digits;
  return null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-5 py-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      {copied ? "Copié" : label}
    </button>
  );
}

function PsiScore({ label, value }: { label: string; value?: number }) {
  const color = value === undefined ? "text-slate-400" : value < 50 ? "text-rose-600" : value < 90 ? "text-amber-600" : "text-emerald-600";
  return (
    <div className="rounded-lg bg-slate-50 p-2 text-center">
      <div className={`text-lg font-bold tabular-nums ${color}`}>{value ?? "—"}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

export function LeadDrawer({ row, locality, onClose, onReaudit }: Props) {
  const { lead, status, opportunity, audit } = row;
  const [psi, setPsi] = useState<PageSpeedResult | null>(null);
  const [psiLoading, setPsiLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function runPsi() {
    if (!lead.website) return;
    setPsiLoading(true);
    try {
      const res = await fetch("/api/pagespeed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: audit?.finalUrl ?? lead.website }),
      });
      const data = await res.json();
      setPsi(res.ok ? data : { url: lead.website, strategy: "mobile", error: data.error });
    } catch (err) {
      setPsi({ url: lead.website, strategy: "mobile", error: (err as Error).message });
    } finally {
      setPsiLoading(false);
    }
  }

  const emails = Array.from(new Set([lead.email, ...(audit?.emails ?? [])].filter(Boolean))) as string[];
  const phones = Array.from(new Set([lead.phone, ...(audit?.phones ?? [])].filter(Boolean))) as string[];
  const socials = Array.from(new Set([...lead.socials, ...(audit?.socials ?? [])]));
  const failed = audit?.checks.filter((c) => !c.ok).sort((a, b) => b.penalty - a.penalty) ?? [];
  const passed = audit?.checks.filter((c) => c.ok) ?? [];
  const pitch = buildPitch(lead, status, audit);

  return (
    <aside className="fixed inset-y-0 right-0 z-[1000] flex w-full max-w-[480px] flex-col border-l border-slate-200 bg-white shadow-2xl">
      <header className="flex items-start gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <OpportunityTag value={opportunity} />
            <StatusBadge status={status} long />
          </div>
          <h2 className="text-lg font-semibold leading-tight text-slate-900">{lead.name}</h2>
          <p className="text-sm text-slate-500">
            {lead.category}
            {lead.isChain && " · chaîne / enseigne"} · à {formatDistance(lead.distance)}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fermer">
          <X className="size-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <Section title="Coordonnées">
          <ul className="space-y-1.5 text-sm text-slate-700">
            {lead.address && (
              <li className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                {lead.address}
              </li>
            )}
            {phones.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-slate-400" />
                <a href={`tel:${p.replace(/\s/g, "")}`} className="hover:underline">
                  {p}
                </a>
                {whatsappNumber(p) && (
                  <a
                    href={`https://wa.me/${whatsappNumber(p)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-600 hover:underline"
                  >
                    WhatsApp
                  </a>
                )}
              </li>
            ))}
            {emails.map((e) => (
              <li key={e} className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-slate-400" />
                <a href={`mailto:${e}`} className="hover:underline">
                  {e}
                </a>
              </li>
            ))}
            {lead.website && (
              <li className="flex items-center gap-2">
                <Globe className="size-4 shrink-0 text-slate-400" />
                <a href={lead.website} target="_blank" rel="noreferrer" className="truncate text-indigo-600 hover:underline">
                  {displayHost(lead.website)}
                </a>
              </li>
            )}
            {socials.map((s) => (
              <li key={s} className="flex items-center gap-2 pl-6">
                <a href={s} target="_blank" rel="noreferrer" className="truncate text-xs text-indigo-600 hover:underline">
                  {s.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </li>
            ))}
            {!phones.length && !emails.length && <li className="text-xs text-slate-400">Aucun téléphone ni email connu.</li>}
            {lead.openingHours && <li className="text-xs text-slate-500">Horaires : {lead.openingHours}</li>}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={lead.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <MapPin className="size-3.5" /> Google Maps
            </a>
            <a
              href={googleSearchUrl(lead, locality)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Search className="size-3.5" /> Vérifier sur Google
            </a>
            {lead.sourceUrl && (
              <a
                href={lead.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="size-3.5" /> OpenStreetMap
              </a>
            )}
          </div>
          {status === "none" && lead.source === "osm" && (
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
              OpenStreetMap n&apos;indique pas de site : vérifiez sur Google avant de démarcher.
            </p>
          )}
        </Section>

        {lead.website && (
          <Section title="Audit du site">
            {!audit ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                {status === "auditing" && <Loader2 className="size-4 animate-spin" />}
                {status === "auditing" ? "Analyse en cours…" : "Pas encore analysé."}
              </p>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  {audit.reachable && audit.checks.length > 0 ? (
                    <div>
                      <div className="text-3xl font-bold tabular-nums text-slate-900">
                        {audit.score}
                        <span className="text-base font-normal text-slate-400">/100</span>
                      </div>
                      <ScoreBar score={audit.score} showValue={false} />
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-rose-700">{audit.reasons[0]}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => onReaudit(lead.website!)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <RefreshCw className="size-3.5" /> Relancer
                  </button>
                </div>
                <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                  {audit.finalUrl && audit.finalUrl !== audit.url && (
                    <>
                      <dt className="text-slate-400">Redirige vers</dt>
                      <dd className="truncate">{displayHost(audit.finalUrl)}</dd>
                    </>
                  )}
                  {audit.httpStatus && (
                    <>
                      <dt className="text-slate-400">Statut HTTP</dt>
                      <dd>{audit.httpStatus}</dd>
                    </>
                  )}
                  {audit.responseTimeMs !== undefined && (
                    <>
                      <dt className="text-slate-400">Réponse serveur</dt>
                      <dd>{(audit.responseTimeMs / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} s</dd>
                    </>
                  )}
                  {audit.copyrightYear && (
                    <>
                      <dt className="text-slate-400">Copyright</dt>
                      <dd>{audit.copyrightYear}</dd>
                    </>
                  )}
                  {audit.title && (
                    <>
                      <dt className="text-slate-400">Titre</dt>
                      <dd className="truncate" title={audit.title}>
                        {audit.title}
                      </dd>
                    </>
                  )}
                </dl>
                {audit.tech.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {audit.tech.map((t) => (
                      <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {failed.length > 0 && (
                  <ul className="space-y-1.5">
                    {failed.map((c) => (
                      <li key={c.id} className="flex gap-2 text-sm">
                        <XCircle
                          className={`mt-0.5 size-4 shrink-0 ${
                            c.severity === "critical" ? "text-rose-600" : c.severity === "major" ? "text-amber-500" : "text-slate-400"
                          }`}
                        />
                        <div>
                          <span className="text-slate-800">{c.detail ?? c.label}</span>
                          <span className="ml-1.5 text-[10px] uppercase text-slate-400">
                            {SEVERITY_LABEL[c.severity]} · −{c.penalty}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {passed.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-xs text-slate-500">{passed.length} points OK</summary>
                    <ul className="mt-1.5 space-y-1">
                      {passed.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 text-xs text-slate-600">
                          <Check className="size-3.5 text-emerald-600" /> {c.label}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}

            <div className="mt-4 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Gauge className="size-4" /> Google PageSpeed (mobile)
                </span>
                <button
                  type="button"
                  onClick={runPsi}
                  disabled={psiLoading}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {psiLoading && <Loader2 className="size-3.5 animate-spin" />}
                  {psiLoading ? "Analyse (~30 s)…" : psi ? "Relancer" : "Lancer"}
                </button>
              </div>
              {psi?.error && <p className="mt-2 text-xs text-rose-600">{psi.error}</p>}
              {psi && !psi.error && (
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  <PsiScore label="Perf." value={psi.performance} />
                  <PsiScore label="Access." value={psi.accessibility} />
                  <PsiScore label="Pratiques" value={psi.bestPractices} />
                  <PsiScore label="SEO" value={psi.seo} />
                  {psi.lcpMs !== undefined && (
                    <p className="col-span-4 text-xs text-slate-500">
                      Affichage principal (LCP) : {(psi.lcpMs / 1000).toFixed(1)} s
                      {psi.cls !== undefined && ` · Stabilité (CLS) : ${psi.cls.toFixed(2)}`}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Section>
        )}

        {status !== "good" && (
          <Section title="Message d'approche (portugais)">
            <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-700">{pitch}</pre>
            <div className="mt-2 flex gap-2">
              <CopyButton text={pitch} label="Copier le message" />
              {emails[0] && (
                <a
                  href={`mailto:${emails[0]}?subject=${encodeURIComponent(`Site web para ${lead.name}`)}&body=${encodeURIComponent(pitch)}`}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Mail className="size-3.5" /> Envoyer par email
                </a>
              )}
            </div>
          </Section>
        )}
      </div>
    </aside>
  );
}
