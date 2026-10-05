import { describe, expect, it } from "vitest";
import { analyzeHtml } from "../audit/analyze";
import { hasFixedLayout } from "../audit/assets";
import { historyFromCdx } from "../audit/wayback";

const NOW = new Date("2026-10-05T12:00:00Z");

const base = { url: "https://example.pt/", finalUrl: "https://example.pt/", status: 200, timeMs: 400, bytes: 40_000, now: NOW };

const filler = "Somos um restaurante familiar no centro de Lagos com cozinha tradicional portuguesa. ".repeat(8);

const MODERN = `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Restaurante O Pescador — Peixe fresco em Lagos</title>
  <meta name="description" content="Restaurante de peixe fresco e marisco no centro histórico de Lagos, Algarve.">
  <meta property="og:title" content="O Pescador"><meta property="og:image" content="https://example.pt/og.jpg">
  <link rel="icon" href="/favicon.ico">
  <script type="application/ld+json">{"@type":"Restaurant"}</script>
</head>
<body>
  <header><h1>O Pescador</h1></header>
  <main><p>${filler}</p><img src="a.jpg" alt="Sala"></main>
  <footer>
    <a href="tel:+351912345678">Ligar</a>
    <a href="mailto:reservas@opescador.pt">reservas@opescador.pt</a>
    <a href="https://www.instagram.com/opescador/">Instagram</a>
    <a href="https://www.facebook.com/sharer/sharer.php?u=x">Partilhar</a>
    © 2026 O Pescador
  </footer>
</body>
</html>`;

const OLD = `<html>
<head><title>Bem-vindo</title></head>
<body bgcolor="#ffffff">
  <center><font face="Arial" size="2">Bem-vindo ao site da Casa Silva</font></center>
  <table width="800"><tr><td width="200"><table><tr><td>Menu</td></tr></table></td><td>${filler}</td></tr></table>
  <p>Contacto: 282 123 456 — casasilva@sapo.pt</p>
  <p>Copyright © 2012 Casa Silva. Todos os direitos reservados.</p>
</body>
</html>`;

describe("analyzeHtml", () => {
  it("rates a modern, well-built site as good", () => {
    const r = analyzeHtml({ ...base, html: MODERN });
    expect(r.verdict).toBe("good");
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.copyrightYear).toBe(2026);
    expect(r.emails).toEqual(["reservas@opescador.pt"]);
    expect(r.phones).toContain("+351912345678");
    expect(r.socials).toEqual(["https://www.instagram.com/opescador/"]);
  });

  it("flags an old non-responsive HTTP site as to redo", () => {
    const r = analyzeHtml({ ...base, url: "http://casasilva.pt/", finalUrl: "http://casasilva.pt/", html: OLD });
    expect(r.verdict).toBe("redo");
    expect(r.https).toBe(false);
    expect(r.copyrightYear).toBe(2012);
    const failed = r.checks.filter((c) => !c.ok).map((c) => c.id);
    expect(failed).toEqual(expect.arrayContaining(["https", "mobile", "freshness", "legacy_html", "table_layout", "title"]));
    expect(r.emails).toContain("casasilva@sapo.pt");
    expect(r.phones).toContain("282123456");
    expect(r.reasons[0]).toMatch(/mobile/i);
  });

  it("marks a site with a few gaps as improvable", () => {
    const html = MODERN.replace(/<meta name="description"[^>]+>/, "")
      .replace(/<meta property="og:[^>]+>/g, "")
      .replace("© 2026", "© 2024")
      .replace(/<script type="application\/ld\+json">.*?<\/script>/, "");
    const r = analyzeHtml({ ...base, html, timeMs: 2200 });
    expect(r.verdict).toBe("improve");
    expect(r.score).toBeLessThan(80);
    expect(r.score).toBeGreaterThanOrEqual(50);
  });

  it("detects parked / for-sale domains", () => {
    const html = `<html><head><title>casasilva.pt</title><meta name="viewport" content="width=device-width"></head>
      <body><h1>This domain is for sale!</h1><p>Buy this domain today.</p></body></html>`;
    const r = analyzeHtml({ ...base, html });
    expect(r.verdict).toBe("redo");
    expect(r.score).toBeLessThanOrEqual(10);
    expect(r.reasons[0]).toMatch(/vendre/);
  });

  it("detects under-construction pages in Portuguese", () => {
    const html = `<html lang="pt"><head><meta name="viewport" content="width=device-width"><title>Casa Silva</title></head>
      <body><h1>Site em construção</h1><p>Brevemente disponível.</p></body></html>`;
    expect(analyzeHtml({ ...base, html }).verdict).toBe("redo");
  });

  it("penalises an invalid certificate even if the final URL is https", () => {
    const r = analyzeHtml({ ...base, html: MODERN, tlsError: "Certificat SSL invalide (CERT_HAS_EXPIRED)" });
    expect(r.https).toBe(false);
    expect(r.checks.find((c) => c.id === "https")?.detail).toMatch(/CERT_HAS_EXPIRED/);
  });

  it("detects technologies and outdated WordPress", () => {
    const html = MODERN.replace(
      "<head>",
      '<head><meta name="generator" content="WordPress 4.9.8"><script src="/wp-includes/js/jquery/jquery.js?ver=1.12.4"></script>',
    );
    const r = analyzeHtml({ ...base, html });
    expect(r.tech).toEqual(expect.arrayContaining(["WordPress 4.9.8", "WordPress", "jQuery 1.12.4"]));
    const failed = r.checks.filter((c) => !c.ok).map((c) => c.id);
    expect(failed).toEqual(expect.arrayContaining(["cms", "libraries"]));
  });

  it("flags free sub-domains", () => {
    const r = analyzeHtml({ ...base, finalUrl: "https://casasilva.wixsite.com/site", html: MODERN });
    expect(r.checks.find((c) => c.id === "domain")?.ok).toBe(false);
  });
});

describe("deep checks", () => {
  const assets = {
    stylesheets: 1,
    cssFetched: 1,
    cssComplete: true,
    mediaQueries: true,
    fixedLayout: true,
    images: 4,
    imagesChecked: 4,
    imageBytes: 400_000,
    modernImages: true,
  };

  it("fails mobile for a fixed-width layout without responsive rules despite the viewport", () => {
    const r = analyzeHtml({ ...base, html: MODERN, assets: { ...assets, mediaQueries: false } });
    expect(r.checks.find((c) => c.id === "mobile")).toMatchObject({ ok: false, penalty: 22 });
    expect(r.checks.find((c) => c.id === "mobile")?.detail).toMatch(/largeur fixe/);
  });

  it("accepts fluid layouts without media queries", () => {
    const r = analyzeHtml({ ...base, html: MODERN, assets: { ...assets, mediaQueries: false, fixedLayout: false } });
    expect(r.checks.find((c) => c.id === "mobile")?.ok).toBe(true);
  });

  it("detects fixed layouts", () => {
    expect(hasFixedLayout("#wrap{width:960px;margin:auto}", "")).toBe(true);
    expect(hasFixedLayout("body{max-width:26em} img{width:100px}", "")).toBe(false);
    expect(hasFixedLayout("", '<table width="800"><tr><td>x</td></tr></table>')).toBe(true);
    expect(hasFixedLayout("", '<table width="100%">')).toBe(false);
  });

  it("does not conclude anything when a stylesheet could not be read", () => {
    const r = analyzeHtml({ ...base, html: MODERN, assets: { ...assets, mediaQueries: false, cssComplete: false } });
    expect(r.checks.find((c) => c.id === "mobile")?.ok).toBe(true);
  });

  it("flags heavy images", () => {
    const r = analyzeHtml({
      ...base,
      html: MODERN,
      assets: { ...assets, imageBytes: 5_200_000, heaviestImage: { url: "https://example.pt/hero.jpg", bytes: 2_500_000 } },
    });
    expect(r.checks.find((c) => c.id === "images_weight")).toMatchObject({ ok: false, penalty: 8 });
  });

  it("uses the Wayback history to spot abandoned sites", () => {
    const stale = analyzeHtml({
      ...base,
      html: MODERN,
      history: { firstSeen: "2009-03", lastCapture: "2026-07", unchangedSince: "2016-02", captures: 120 },
    });
    expect(stale.checks.find((c) => c.id === "history")).toMatchObject({ ok: false });
    expect(stale.history?.firstSeen).toBe("2009-03");

    const fresh = analyzeHtml({
      ...base,
      html: MODERN,
      history: { firstSeen: "2009-03", lastCapture: "2026-07", unchangedSince: "2026-05", captures: 120 },
    });
    expect(fresh.checks.find((c) => c.id === "history")?.ok).toBe(true);

    // Not archived recently: no conclusion.
    const old = analyzeHtml({
      ...base,
      html: MODERN,
      history: { firstSeen: "2009-03", lastCapture: "2019-07", unchangedSince: "2012-01", captures: 30 },
    });
    expect(old.checks.find((c) => c.id === "history")).toBeUndefined();
  });
});

describe("historyFromCdx", () => {
  it("finds when the homepage last changed", () => {
    const rows = [
      ["timestamp", "digest"],
      ["20090301000000", "A"],
      ["20120101000000", "B"],
      ["20160201000000", "C"],
      ["20200101000000", "C"],
      ["20260701000000", "C"],
    ];
    expect(historyFromCdx(rows)).toEqual({ firstSeen: "2009-03", lastCapture: "2026-07", unchangedSince: "2016-02", captures: 5 });
    expect(historyFromCdx([])).toBeNull();
  });
});
