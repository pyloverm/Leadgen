import type { LeadView } from "./leads";
import type { AuditResult } from "./types";
import { displayHost } from "./urls";

/** Portuguese phrasing of each audit check, used to build a first contact message. */
const PT_ISSUES: Record<string, (audit: AuditResult) => string> = {
  online: () => "o site não está ativo (página em construção ou domínio parado)",
  https: () => "o site não é seguro (sem HTTPS) e o navegador mostra o aviso «Não seguro»",
  mobile: () => "o site não está adaptado a telemóveis, onde hoje está a maioria dos clientes",
  obsolete_tech: () => "usa tecnologia ultrapassada que já não funciona nos navegadores atuais",
  freshness: (a) => `o conteúdo parece desatualizado (a última data visível é ${a.copyrightYear})`,
  legacy_html: () => "o design está datado face aos sites atuais",
  table_layout: () => "o design está datado face aos sites atuais",
  speed: () => "o site demora bastante a carregar",
  content: () => "tem pouco conteúdo para aparecer bem no Google",
  title: () => "não está otimizado para o Google (SEO)",
  meta_description: () => "não está otimizado para o Google (SEO)",
  contact: () => "não é fácil contactar-vos com um clique a partir do telemóvel",
  domain: () => "usa um endereço gratuito em vez de um domínio próprio",
  cms: () => "usa uma versão antiga do sistema, com falhas de segurança conhecidas",
  history: (a) => `a página principal não é atualizada desde ${a.history?.unchangedSince.slice(0, 4)}`,
  images_weight: () => "as imagens são muito pesadas e tornam o site lento no telemóvel",
};

export function buildPitch({ lead, status, audit, discovery, website }: LeadView): string {
  const hello = `Olá, ${lead.name}!`;
  const offer =
    "Sou web designer e crio sites profissionais, rápidos e adaptados ao telemóvel, a preços acessíveis para pequenos negócios.";
  const close = "Posso mostrar-vos uma proposta, sem compromisso? Obrigado e bom trabalho!";

  const parked = discovery?.parked[0];
  if ((status === "none" || status === "social") && parked) {
    return [
      hello,
      `Reparei que o domínio ${parked}, com o vosso nome, está registado mas sem nenhum site ativo. Se for vosso, é uma oportunidade perdida: quem vos procura no Google não encontra nada.`,
      offer,
      close,
    ].join("\n\n");
  }
  if (status === "none") {
    return [
      hello,
      `Ao procurar negócios na vossa zona, reparei que ainda não têm um site. Hoje a maioria dos clientes pesquisa no Google antes de escolher, e um site simples ajuda a ser encontrado e a receber mais contactos.`,
      offer,
      close,
    ].join("\n\n");
  }
  if (status === "social") {
    return [
      hello,
      "Vi que estão presentes nas redes sociais, mas ainda não têm um site próprio. Um site com os vossos serviços, horários e contactos dá mais confiança e aparece no Google, mesmo para quem não usa Facebook ou Instagram.",
      offer,
      close,
    ].join("\n\n");
  }

  const host = website ? displayHost(website) : "o vosso site";
  let issues: string[] = [];
  if (audit && !audit.reachable) {
    issues = ["o site não está acessível neste momento"];
  } else if (audit) {
    issues = Array.from(
      new Set(
        audit.checks
          .filter((c) => !c.ok && PT_ISSUES[c.id])
          .sort((a, b) => b.penalty - a.penalty)
          .map((c) => PT_ISSUES[c.id](audit)),
      ),
    ).slice(0, 3);
  }
  const list = issues.length ? `\n${issues.map((i) => `• ${i}`).join("\n")}` : "";
  return [
    hello,
    `Estive a ver o ${host} e reparei em alguns pontos que podem estar a afastar clientes:${list}`,
    status === "redo"
      ? "Posso criar-vos um site novo, moderno e pensado para gerar contactos."
      : "Com algumas melhorias, o site pode trazer bastante mais contactos.",
    offer,
    close,
  ].join("\n\n");
}
