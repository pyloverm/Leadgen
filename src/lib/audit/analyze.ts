import * as cheerio from "cheerio";
import type { AssetStats, AuditCheck, AuditResult, AuditVerdict, CheckSeverity, SiteHistory } from "../types";

export interface AnalyzeInput {
  url: string;
  finalUrl: string;
  status: number;
  html: string;
  timeMs: number;
  bytes: number;
  /** Set when HTTPS failed because of a certificate problem and we fell back to HTTP. */
  tlsError?: string;
  /** Stylesheets / images inspection (optional, needs extra requests). */
  assets?: AssetStats;
  /** Wayback Machine history of the homepage (optional). */
  history?: SiteHistory | null;
  now?: Date;
}

const FREE_SUBDOMAINS = [
  "wixsite.com",
  "wix.com",
  "wordpress.com",
  "blogspot.com",
  "blogspot.pt",
  "weebly.com",
  "jimdofree.com",
  "jimdosite.com",
  "webnode.pt",
  "webnode.page",
  "site123.me",
  "godaddysites.com",
  "square.site",
  "webflow.io",
  "carrd.co",
  "ueniweb.com",
  "business.site",
  "negocio.site",
  "github.io",
  "netlify.app",
  "sites.google.com",
  "e-monsite.com",
  "simplesite.com",
];

const PARKED_PATTERNS: [RegExp, string][] = [
  [/domain (name )?(is )?for sale|buy this domain|this domain may be for sale|dom[ií]nio (est[aá] )?[àa] venda/i, "Nom de domaine à vendre"],
  [/sedoparking|parkingcrew|bodis\.com|afternic|hugedomains|dan\.com\/buy-domain|domain parking|parked (free|domain)|is parked/i, "Domaine parqué (page publicitaire)"],
  [/under construction|em constru[cç][aã]o|site en construction|en construcci[oó]n|website coming soon|coming soon|brevemente dispon[ií]vel|estamos a preparar/i, "Site « en construction » / « bientôt disponible »"],
  [/account (has been )?suspended|conta suspensa|website (has )?expired|this site is (currently )?unavailable|hosting (has )?expired/i, "Hébergement suspendu ou expiré"],
  [/apache2? (ubuntu |debian )?default page|welcome to nginx!|it works!<\/h1>|index of \/<\/title>|default web site page|plesk (obsidian|onyx)? ?default|cpanel default|hostinger default/i, "Page par défaut du serveur (site vide)"],
];

/** Returns why a page is a parked / empty / "coming soon" page, or null. */
export function detectParked(title: string, text: string, html: string): string | null {
  const sample = `${title} ${text.slice(0, 5000)} ${html.slice(0, 3000)}`;
  return PARKED_PATTERNS.find(([re]) => re.test(sample))?.[1] ?? null;
}

/** Site builders whose themes are responsive even when we cannot see their CSS. */
const RESPONSIVE_BUILDERS = ["Wix", "Squarespace", "Shopify", "Webflow", "Jimdo", "GoDaddy Builder", "Site123", "Weebly", "Webnode"];

const mb = (bytes: number) => `${(bytes / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;

const GENERIC_TITLES = /^(home|homepage|in[ií]cio|p[aá]gina inicial|accueil|untitled|sem t[ií]tulo|welcome|bem[- ]vindo|index|default|my site|meu site|site)$/i;

const SOCIAL_RE = /^https?:\/\/(www\.|m\.|[a-z]{2}-[a-z]{2}\.)?(facebook\.com|instagram\.com|linkedin\.com|tiktok\.com|youtube\.com|x\.com|twitter\.com|pinterest\.[a-z]+|tripadvisor\.[a-z.]+)\//i;
const SHARE_RE = /sharer|share\.php|\/share\?|intent\/tweet|\/plugins\/|\/dialog\//i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const EMAIL_JUNK = /\.(png|jpe?g|gif|svg|webp|avif)$|example\.|sentry|wixpress|domain\.com|email\.com|yourname|seudominio|@2x|u00|godaddy\.com|wordpress\.(com|org)$|sitedomain/i;
const PT_PHONE_RE = /(?:\+351[\s.]?)?\b(?:9[1236]\d|2\d\d)[\s.]?\d{3}[\s.]?\d{3}\b/g;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function detectTech(html: string, $: cheerio.CheerioAPI): string[] {
  const tech = new Set<string>();
  const generator = $('meta[name="generator" i]').attr("content")?.trim();
  if (generator) tech.add(generator.replace(/\s*-\s*Open Source.*$/i, "").slice(0, 60));
  const h = html.slice(0, 600_000);
  const rules: [RegExp, string][] = [
    [/wp-content|wp-includes/i, "WordPress"],
    [/elementor/i, "Elementor"],
    [/\/themes\/Divi|et_pb_/i, "Divi"],
    [/static\.wixstatic\.com|wix\.com|_wixCIDX/i, "Wix"],
    [/squarespace/i, "Squarespace"],
    [/cdn\.shopify\.com/i, "Shopify"],
    [/webflow/i, "Webflow"],
    [/jimdo/i, "Jimdo"],
    [/img1\.wsimg\.com|godaddy/i, "GoDaddy Builder"],
    [/prestashop/i, "PrestaShop"],
    [/\/media\/jui\/|\/media\/system\/js|joomla/i, "Joomla"],
    [/drupal/i, "Drupal"],
    [/weebly/i, "Weebly"],
    [/webnode/i, "Webnode"],
    [/site123/i, "Site123"],
    [/__NEXT_DATA__|\/_next\/static/i, "Next.js"],
    [/__NUXT__|\/_nuxt\//i, "Nuxt"],
    [/googletagmanager\.com\/gtm/i, "Google Tag Manager"],
    [/gtag\(|google-analytics\.com|googletagmanager\.com\/gtag/i, "Google Analytics"],
    [/fbq\(|connect\.facebook\.net\/.*fbevents/i, "Meta Pixel"],
    [/bootstrap(\.min)?\.(css|js)/i, "Bootstrap"],
  ];
  for (const [re, name] of rules) if (re.test(h)) tech.add(name);
  const jq = h.match(/jquery[.-]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js|jquery(?:\.min)?\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i);
  if (jq) tech.add(`jQuery ${jq[1] ?? jq[2]}`);
  else if (/jquery/i.test(h)) tech.add("jQuery");
  return [...tech];
}

function oldCmsVersion(tech: string[]): string | null {
  for (const t of tech) {
    const wp = t.match(/^WordPress (\d+)\.(\d+)/i);
    if (wp && Number(wp[1]) < 6) return t;
    const joomla = t.match(/^Joomla!? ?(\d+(?:\.\d+)?)/i);
    if (joomla && Number.parseFloat(joomla[1]) < 4) return t;
    if (/^Joomla! 1\.5|^Drupal [5-7]\b/i.test(t)) return t;
  }
  return null;
}

function oldLibrary(tech: string[], html: string): string | null {
  const jq = tech.find((t) => /^jQuery \d/.test(t));
  if (jq && /^jQuery [12]\./.test(jq)) return jq;
  const bs = html.match(/bootstrap[/@-]?v?([23])\.\d+(\.\d+)?/i);
  if (bs) return `Bootstrap ${bs[1]}`;
  return null;
}

function findCopyrightYear(text: string, html: string, now: Date): { year?: number; dynamic: boolean } {
  const years: number[] = [];
  const re = /(?:©|&copy;|\(c\)|copyright|todos os direitos)\D{0,40}?((?:19|20)\d{2})(?:\s*[-–—/]\s*((?:19|20)\d{2}))?/gi;
  for (const m of text.matchAll(re)) {
    for (const y of [m[1], m[2]]) {
      const n = Number(y);
      if (n >= 1995 && n <= now.getFullYear() + 1) years.push(n);
    }
  }
  if (years.length) return { year: Math.max(...years), dynamic: false };
  return { dynamic: /getFullYear\(\)/.test(html) };
}

function extractEmails($: cheerio.CheerioAPI, text: string): string[] {
  const found = new Set<string>();
  $('a[href^="mailto:" i]').each((_, el) => {
    const raw = decodeURIComponent(($(el).attr("href") ?? "").replace(/^mailto:/i, "").split("?")[0]).trim();
    if (raw) found.add(raw.toLowerCase());
  });
  for (const m of text.matchAll(EMAIL_RE)) found.add(m[0].toLowerCase());
  return [...found].filter((e) => !EMAIL_JUNK.test(e) && e.length < 80).slice(0, 5);
}

function extractPhones($: cheerio.CheerioAPI, text: string): string[] {
  const found = new Set<string>();
  $('a[href^="tel:" i]').each((_, el) => {
    const tel = ($(el).attr("href") ?? "").replace(/^tel:/i, "").replace(/[^\d+]/g, "");
    if (tel.length >= 9) found.add(tel);
  });
  for (const m of text.matchAll(PT_PHONE_RE)) found.add(m[0].replace(/[\s.]/g, ""));
  return [...found].slice(0, 3);
}

function extractSocials($: cheerio.CheerioAPI): string[] {
  const found = new Map<string, string>();
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!SOCIAL_RE.test(href) || SHARE_RE.test(href)) return;
    try {
      const u = new URL(href);
      const key = `${u.hostname.replace(/^(www|m)\./, "")}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
      if (u.pathname.length > 1 && !found.has(key)) found.set(key, href);
    } catch {
      /* ignore malformed links */
    }
  });
  return [...found.values()].slice(0, 6);
}

export function analyzeHtml(input: AnalyzeInput): Omit<AuditResult, "url" | "auditedAt"> {
  const now = input.now ?? new Date();
  const html = input.html;
  const $ = cheerio.load(html);
  const https = input.finalUrl.startsWith("https://") && !input.tlsError;
  const host = hostOf(input.finalUrl);

  const tech = detectTech(html, $);
  const title = $("title").first().text().replace(/\s+/g, " ").trim() || undefined;
  const lang = $("html").attr("lang")?.trim();
  const viewport = $('meta[name="viewport" i]').attr("content") ?? "";
  const description = $('meta[name="description" i]').attr("content")?.trim() ?? "";
  const ogCount = $('meta[property^="og:" i]').length;
  const jsonLd = $('script[type="application/ld+json"]').length + $("[itemscope]").length;
  const favicon = $('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel="apple-touch-icon" i]').length;
  const scripts = $("script").length;
  const images = $("img");
  const imagesNoAlt = images.filter((_, el) => !($(el).attr("alt") ?? "").trim()).length;
  const hasContact =
    $('a[href^="tel:" i], a[href^="mailto:" i], a[href*="wa.me" i], a[href*="api.whatsapp.com" i], form').length > 0;
  const legacyTags = $("font, center, marquee, blink, [bgcolor]").length;
  const tableLayout = $("table table").length > 0 || $("table[width], td[width], td[bgcolor], table[background]").length >= 3;
  const flash = /\.swf\b|application\/x-shockwave-flash|D27CDB6E-AE6D-11cf/i.test(html);
  const frames = $("frameset, frame").length > 0;
  const applets = $("applet").length > 0 || /silverlight/i.test(html);
  const mixed = https && /\s(src|href)=["']http:\/\/[^"']+\.(js|css|png|jpe?g|gif|webp)/i.test(html);

  $("script, style, noscript, template, svg").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const copyright = findCopyrightYear(text, html, now);
  const parked = detectParked(title ?? "", text, html);
  const freeSub = FREE_SUBDOMAINS.find((d) => host === d || host.endsWith(`.${d}`));
  const cmsOld = oldCmsVersion(tech);
  const libOld = oldLibrary(tech, html);

  const checks: AuditCheck[] = [];
  const add = (id: string, label: string, ok: boolean, severity: CheckSeverity, penalty: number, detail?: string) =>
    checks.push({ id, label, ok, severity, penalty: ok ? 0 : penalty, detail: ok ? undefined : detail });

  add("online", "Site en ligne et actif", !parked, "critical", 60, parked ?? undefined);
  add(
    "https",
    "Connexion sécurisée (HTTPS)",
    https,
    "critical",
    20,
    input.tlsError ?? "Pas de HTTPS : « Non sécurisé » dans le navigateur",
  );
  // "initial-scale=1" alone also makes browsers use the device width.
  const hasViewport = /width\s*=\s*device-width|initial-scale\s*=\s*1(?:\.0)?(?![.\d])/i.test(viewport);
  const assets = input.assets;
  // A viewport tag alone is not enough: a fixed-width layout without any @media rule cannot adapt to phones.
  const noResponsiveCss =
    hasViewport &&
    assets !== undefined &&
    assets.cssComplete &&
    !assets.mediaQueries &&
    assets.fixedLayout &&
    !tech.some((t) => RESPONSIVE_BUILDERS.includes(t));
  add(
    "mobile",
    "Adapté au mobile",
    hasViewport && !noResponsiveCss,
    "critical",
    noResponsiveCss ? 22 : 30,
    noResponsiveCss
      ? "Mise en page à largeur fixe sans règle responsive : illisible sur téléphone"
      : viewport
        ? `Viewport non responsive (${viewport.slice(0, 40)})`
        : "Pas de balise viewport : site non adapté au mobile",
  );
  add(
    "obsolete_tech",
    "Pas de technologie obsolète",
    !flash && !frames && !applets,
    "critical",
    25,
    [flash && "Flash", frames && "cadres (frames)", applets && "applets/Silverlight"].filter(Boolean).join(", ") + " : technologie abandonnée",
  );

  if (copyright.year !== undefined) {
    const age = now.getFullYear() - copyright.year;
    const old = age >= 4;
    add(
      "freshness",
      "Contenu à jour",
      age < 2,
      old ? "major" : "minor",
      old ? 15 : 6,
      `Copyright ${copyright.year} : site pas mis à jour depuis ${age} an${age > 1 ? "s" : ""}`,
    );
  }

  add("legacy_html", "HTML moderne", legacyTags === 0, "major", 10, `Balises HTML obsolètes (${legacyTags} × <font>, <center>…)`);
  add("table_layout", "Mise en page moderne", !tableLayout, "major", 8, "Mise en page en tableaux (années 2000)");
  if (input.timeMs > 3000) add("speed", "Temps de réponse du serveur", false, "major", 10, `Serveur lent : ${(input.timeMs / 1000).toFixed(1)} s`);
  else add("speed", "Temps de réponse du serveur", input.timeMs <= 1500, "minor", 4, `Serveur un peu lent : ${(input.timeMs / 1000).toFixed(1)} s`);
  add("weight", "Poids de la page", input.bytes <= 2_000_000, "minor", 4, `Page très lourde (${(input.bytes / 1e6).toFixed(1)} Mo de HTML)`);
  if (assets && assets.imagesChecked > 0) {
    const heavy = (assets.heaviestImage?.bytes ?? 0) > 1_000_000 || assets.imageBytes > 3_000_000;
    add(
      "images_weight",
      "Images optimisées",
      !heavy,
      "major",
      8,
      assets.imagesChecked > 1
        ? `Images trop lourdes : ${mb(assets.imageBytes)} pour ${assets.imagesChecked} images (la plus lourde ${mb(assets.heaviestImage?.bytes ?? 0)})`
        : `Image trop lourde : ${mb(assets.imageBytes)}`,
    );
  }
  if (assets && assets.images >= 3) {
    add("images_format", "Formats d'image modernes", assets.modernImages, "minor", 2, "Pas de WebP/AVIF : images plus lentes à charger");
  }
  const history = input.history;
  if (history) {
    const unchangedYear = Number(history.unchangedSince.slice(0, 4));
    const lastCaptureAge = now.getFullYear() * 12 + now.getMonth() - (Number(history.lastCapture.slice(0, 4)) * 12 + Number(history.lastCapture.slice(5, 7)) - 1);
    // Only meaningful when the archive saw the site recently.
    if (lastCaptureAge <= 18) {
      const years = now.getFullYear() - unchangedYear;
      add(
        "history",
        "Site mis à jour",
        years < 3,
        "major",
        12,
        `Page d'accueil strictement identique depuis ${unchangedYear} (archives du web)`,
      );
    }
  }

  if (text.length < 250) {
    const spa = scripts >= 5;
    add(
      "content",
      "Contenu texte suffisant",
      false,
      "major",
      spa ? 6 : 12,
      spa ? "Contenu chargé uniquement en JavaScript (invisible pour Google)" : "Très peu de contenu sur la page d'accueil",
    );
  } else {
    add("content", "Contenu texte suffisant", true, "major", 0);
  }

  add("title", "Titre de page (SEO)", Boolean(title && !GENERIC_TITLES.test(title)), "major", 8, title ? `Titre générique « ${title} »` : "Pas de titre de page");
  add("meta_description", "Meta description (SEO)", description.length >= 30, "major", 6, "Pas de meta description pour Google");
  add("h1", "Titre principal (H1)", $("h1").length > 0, "minor", 4, "Pas de titre H1");
  add("contact", "Contact en un clic", hasContact, "major", 5, "Pas de téléphone/email cliquable ni de formulaire");
  add("domain", "Nom de domaine professionnel", !freeSub, "major", 10, `Sous-domaine gratuit (${freeSub})`);
  add("cms", "CMS à jour", !cmsOld, "major", 8, `Version obsolète : ${cmsOld} (failles de sécurité)`);
  add("libraries", "Bibliothèques à jour", !libOld, "minor", 4, `Bibliothèque obsolète : ${libOld}`);
  add("mixed_content", "Pas de contenu mixte", !mixed, "minor", 4, "Ressources chargées en HTTP sur une page HTTPS");
  add("lang", "Langue déclarée", Boolean(lang), "minor", 2, "Langue de la page non déclarée");
  add("favicon", "Favicon", favicon > 0, "minor", 2, "Pas de favicon déclaré");
  add("open_graph", "Aperçu sur les réseaux sociaux", ogCount >= 2, "minor", 3, "Pas de balises Open Graph (partage Facebook/WhatsApp moche)");
  add("structured_data", "Données structurées (schema.org)", jsonLd > 0, "minor", 2, "Pas de données structurées pour Google");
  if (images.length >= 4) {
    add("images_alt", "Images accessibles", imagesNoAlt / images.length <= 0.5, "minor", 3, `${imagesNoAlt}/${images.length} images sans texte alternatif`);
  }

  const penalty = checks.reduce((sum, c) => sum + c.penalty, 0);
  let score = Math.max(0, 100 - penalty);
  if (parked) score = Math.min(score, 10);

  const failed = (id: string) => checks.some((c) => c.id === id && !c.ok);
  const outdatedDesign =
    failed("obsolete_tech") ||
    failed("legacy_html") ||
    failed("table_layout") ||
    failed("history") ||
    checks.some((c) => c.id === "freshness" && !c.ok && c.severity === "major");

  let verdict: AuditVerdict;
  if (parked || score < 50 || (failed("mobile") && outdatedDesign)) verdict = "redo";
  else if (score < 80) verdict = "improve";
  else verdict = "good";

  const reasons = checks
    .filter((c) => !c.ok)
    .sort((a, b) => b.penalty - a.penalty)
    .map((c) => c.detail ?? c.label);

  return {
    finalUrl: input.finalUrl,
    reachable: true,
    httpStatus: input.status,
    https,
    responseTimeMs: input.timeMs,
    htmlBytes: input.bytes,
    score,
    verdict,
    reasons,
    checks,
    tech,
    copyrightYear: copyright.year,
    title,
    emails: extractEmails($, text),
    phones: extractPhones($, text),
    socials: extractSocials($),
    assets,
    history: history ?? undefined,
  };
}
