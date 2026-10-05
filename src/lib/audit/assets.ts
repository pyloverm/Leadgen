import * as cheerio from "cheerio";
import type { AssetStats } from "../types";
import { safeFetch } from "./safe-fetch";

const MAX_STYLESHEETS = 5;
const MAX_IMAGES = 10;
export const RESPONSIVE_RE = /@media[^{]*\((?:max|min)-(?:device-)?width/i;
const FIXED_CSS_WIDTH_RE = /(?:^|[{;\s"'])(?:min-)?width\s*:\s*(\d{3,4})px/gi;
const FIXED_ATTR_WIDTH_RE = /<(?:table|div|td|body|center)\b[^>]*\swidth=["']?(\d{3,4})(?!%)/gi;

/** Fluid layouts (max-width, flex, %…) adapt without @media; a fixed 960px wrapper never does. */
export function hasFixedLayout(css: string, html: string): boolean {
  const wide = (re: RegExp, s: string) => [...s.matchAll(re)].some((m) => Number(m[1]) >= 700);
  return wide(FIXED_CSS_WIDTH_RE, css) || wide(FIXED_CSS_WIDTH_RE, html.slice(0, 300_000)) || wide(FIXED_ATTR_WIDTH_RE, html);
}

function resolve(href: string | undefined, base: string): string | null {
  if (!href || href.startsWith("data:")) return null;
  try {
    const u = new URL(href.trim(), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function collectAssetUrls(html: string, baseUrl: string) {
  const $ = cheerio.load(html);
  const stylesheets = $('link[rel~="stylesheet" i][href]')
    .map((_, el) => resolve($(el).attr("href"), baseUrl))
    .get()
    .filter((u): u is string => Boolean(u));
  const images = $("img")
    .map((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src") || $(el).attr("srcset")?.split(/[\s,]/)[0];
      return resolve(src, baseUrl);
    })
    .get()
    .filter((u): u is string => Boolean(u) && !/\.svg(\?|$)/i.test(u));
  const inlineCss = $("style")
    .map((_, el) => $(el).text())
    .get()
    .join("\n");
  // <link media="(max-width: 600px)"> is a responsive rule too.
  const linkMedia = $("link[media]")
    .map((_, el) => `@media ${$(el).attr("media")} {}`)
    .get()
    .join("\n");
  return { stylesheets: [...new Set(stylesheets)], images: [...new Set(images)], inlineCss: `${inlineCss}\n${linkMedia}` };
}

async function imageSize(url: string): Promise<number | null> {
  try {
    const res = await safeFetch(url, { method: "HEAD", timeoutMs: 5000, maxBytes: 0 });
    const len = Number(res.headers.get("content-length"));
    return res.status < 400 && Number.isFinite(len) && len > 0 ? len : null;
  } catch {
    return null;
  }
}

/** Downloads the stylesheets and probes the images of a page (all free, plain HTTP). */
export async function inspectAssets(html: string, baseUrl: string): Promise<AssetStats> {
  const { stylesheets, images, inlineCss } = collectAssetUrls(html, baseUrl);
  const toCheck = images.slice(0, MAX_IMAGES);

  const [css, sizes] = await Promise.all([
    Promise.all(
      stylesheets.slice(0, MAX_STYLESHEETS).map((u) =>
        safeFetch(u, { timeoutMs: 6000, maxBytes: 800_000 })
          .then((r) => (r.status < 400 ? r.body : null))
          .catch(() => null),
      ),
    ),
    Promise.all(toCheck.map(imageSize)),
  ]);

  const fetchedCss = css.filter((c): c is string => c !== null);
  let heaviest: AssetStats["heaviestImage"];
  let imageBytes = 0;
  sizes.forEach((size, i) => {
    if (size === null) return;
    imageBytes += size;
    if (!heaviest || size > heaviest.bytes) heaviest = { url: toCheck[i], bytes: size };
  });

  return {
    stylesheets: stylesheets.length,
    cssFetched: fetchedCss.length + (inlineCss.trim() ? 1 : 0),
    cssComplete:
      stylesheets.length <= MAX_STYLESHEETS &&
      fetchedCss.length === stylesheets.length &&
      ![inlineCss, ...fetchedCss].some((c) => c.includes("@import")),
    mediaQueries: [inlineCss, ...fetchedCss].some((c) => RESPONSIVE_RE.test(c)),
    fixedLayout: hasFixedLayout([inlineCss, ...fetchedCss].join("\n"), html),
    images: images.length,
    imagesChecked: sizes.filter((s) => s !== null).length,
    imageBytes,
    heaviestImage: heaviest,
    modernImages: images.some((u) => /\.(webp|avif)(\?|$)/i.test(u)) || /image\/(webp|avif)|\.webp|\.avif/i.test(html),
  };
}
