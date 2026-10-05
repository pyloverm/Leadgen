import { describe, expect, it } from "vitest";
import { analyzeHtml } from "../audit/analyze";

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
