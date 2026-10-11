import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Farol, Indicador } from "./analise.functions";
import { avaliar, menciona, mencionaCidade, tokens, type Alvo } from "./desambiguacao";

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

export type PerfilSocial = { rede: string; url: string; verificado: boolean; motivos: string[] };
export type Comentario = { texto: string; estrelas: number | null; fonte: string; reclamacao: boolean };
export type Citacao = { titulo: string; url: string; confianca: "ALTA" | "BAIXA" };

export type Varredura = {
  presenca: { site: string | null; perfis: PerfilSocial[] };
  google: { nota: number | null; total: number | null };
  reclameAqui: { url: string | null; nota: number | null; reclamacoes: number | null; respondidas_pct: number | null; reputacao: string | null };
  comentarios: Comentario[];
  juridico: { citacoes: Citacao[]; alta: number; baixa: number };
  indicadores: Indicador[];
  discriminacao: { rotulo: string; delta: number }[];
  erros: string[];
};

async function fc(path: string, body: unknown): Promise<any> {
  const lov = process.env["LOVABLE_API_KEY"];
  const key = process.env["FIRECRAWL_API_KEY"];
  if (!lov || !key) throw new Error("FIRECRAWL_NAO_CONFIGURADO");
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`firecrawl ${path} [${res.status}]: ${t}`);
    throw new Error(`firecrawl ${res.status}`);
  }
  return res.json();
}

type RA = { url: string | null; nota: number | null; reclamacoes: number | null; respondidas_pct: number | null; reputacao: string | null; comentarios: string[] };
type Hit = { url: string; title?: string; description?: string; markdown?: string };
async function search(query: string, limit = 10, scrape = false): Promise<Hit[]> {
  const r = await fc("/search", {
    query, limit, lang: "pt", country: "br",
    ...(scrape ? { scrapeOptions: { formats: ["markdown"], onlyMainContent: true } } : {}),
  });
  const d = r?.data;
  return (Array.isArray(d) ? d : (d?.web ?? [])) as Hit[];
}

async function scrapePagina(url: string): Promise<{ markdown: string; links: string[] }> {
  const r = await fc("/scrape", { url, formats: ["markdown", "links"], onlyMainContent: false, waitFor: 1000 });
  const d = r?.data ?? r ?? {};
  return { markdown: String(d.markdown ?? "").slice(0, 20000), links: Array.isArray(d.links) ? d.links.map(String) : [] };
}

const REDES: [string, RegExp][] = [
  ["Instagram", /instagram\.com\/[^/?#]+/i],
  ["LinkedIn", /linkedin\.com\/company\/[^/?#]+/i],
  ["Facebook", /facebook\.com\/[^/?#]+/i],
  ["YouTube", /youtube\.com\/(@|c\/|channel\/)[^/?#]+/i],
  ["X / Twitter", /(twitter|x)\.com\/[^/?#]+/i],
  ["TikTok", /tiktok\.com\/@[^/?#]+/i],
];
const NAO_SITE = /instagram|linkedin|facebook|youtube|twitter|x\.com|tiktok|reclameaqui|jusbrasil|escavador|consumidor\.gov|google|wikipedia|cnpj|econodata|casadosdados|solutudo|serasa|gov\.br/i;
const PALAVRAS_RECLAMACAO = /(p[eé]ssim|horr[ií]vel|golpe|fraude|n[aã]o recomendo|descaso|enganad|reclama|nunca (chegou|entreg)|atras(o|ad)|cobran[cç]a indevida|n[aã]o resolve|mal atendid|p[eé]ssimo atendimento|lixo)/i;

export const varrerWeb = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      cnpj: z.string().regex(/^\d{14}$/),
      razao_social: z.string().min(1).max(200),
      nome_fantasia: z.string().max(200).nullable(),
      municipio: z.string().max(100).nullable(),
      uf: z.string().max(2).nullable(),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<Varredura> => {
        const nome = data.nome_fantasia?.trim() || data.razao_social;
    const toks = tokens(nome);
    const toksRazao = tokens(data.razao_social);
    const local = [data.municipio, data.uf].filter(Boolean).join(" ");
    const cnpjFmt = data.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    const erros: string[] = [];
    const safe = async <T,>(nomeEtapa: string, f: () => Promise<T>, fb: T): Promise<T> => {
      try { return await f(); } catch (e) { console.error(nomeEtapa, e); erros.push(nomeEtapa); return fb; }
    };

    const alvoBase: Alvo = { toksNome: toks, toksRazao, municipio: data.municipio, uf: data.uf, cnpj: data.cnpj };
    const cidade = data.municipio ?? "";
    let raHits: Hit[] = [];
    const [social, google, reclame, juri] = await Promise.all([
      // 1. Presença digital — desambiguação por nome + cidade + UF + CNPJ + vínculo com site oficial
      safe("presenca", async () => {
        const [h1, h2, h3] = await Promise.all([
          search(`"${nome}" ${local} instagram OR facebook OR linkedin`, 15),
          search(`"${nome}" ${cidade} site oficial contato`, 10),
          search(`"${cnpjFmt}" OR "${data.cnpj}"`, 10).catch(() => [] as Hit[]),
        ]);
        const hits = [...h1, ...h2, ...h3];
        const txt = (h: Hit) => `${h.title ?? ""} ${h.description ?? ""} ${h.url.replace(/[-_]/g, " ")}`;

        // 1a. Site oficial: candidato precisa citar nome; confirmado se a página citar cidade ou CNPJ
        let site: string | null = null;
        const linksSite = new Set<string>();
        const candidatosSite = [...new Map(hits
          .filter((h) => !NAO_SITE.test(h.url) && (menciona(txt(h), toks) || menciona(txt(h), toksRazao)))
          .map((h) => [new URL(h.url).origin, h])).values()].slice(0, 2);
        for (const c of candidatosSite) {
          try {
            const p = await scrapePagina(new URL(c.url).origin);
            const av = avaliar(`${txt(c)} ${p.markdown}`, alvoBase);
            if (av.verificado) {
              site = new URL(c.url).origin;
              p.links.forEach((l) => linksSite.add(l.toLowerCase()));
              break;
            }
          } catch (e) { console.error("site", c.url, e); }
        }

        // 1b. Perfis: links do site oficial têm prioridade; depois resultados de busca avaliados
        type Cand = PerfilSocial & { pontos: number };
        const melhor = new Map<string, Cand>();
        const considerar = (rede: string, url: string, texto: string, linkado: boolean) => {
          const av = avaliar(texto, alvoBase, { linkadoNoSite: linkado });
          if (av.conflito) return; // homônimo de outra localidade: descartado
          if (!av.verificado && !menciona(texto, toks) && !menciona(texto, toksRazao)) return;
          const atual = melhor.get(rede);
          if (!atual || av.pontos > atual.pontos) melhor.set(rede, { rede, url, verificado: av.verificado, motivos: av.motivos, pontos: av.pontos });
        };
        const casar = (u: string) => {
          for (const [rede, re] of REDES) {
            const m = u.match(re);
            if (m && !/\/(business|sharer|share|login|help|watch|explore|p|reel|hashtag|intent|plugins|dialog)\b/i.test(m[0])) return { rede, url: `https://${m[0].replace(/^www\./, "")}` };
          }
          return null;
        };
        for (const l of linksSite) {
          const c = casar(l);
          if (c) considerar(c.rede, c.url, nome, true);
        }
        for (const h of hits) {
          const c = casar(h.url);
          if (c) considerar(c.rede, c.url, txt(h), false);
        }

        // 1c. Perfis ainda não confirmados: lê a bio/postagens públicas buscando cidade ou CNPJ
        const pendentes = [...melhor.values()].filter((p) => !p.verificado).slice(0, 3);
        await Promise.all(pendentes.map(async (p) => {
          try {
            const pg = await scrapePagina(p.url);
            const av = avaliar(`${nome} ${pg.markdown}`, alvoBase, { linkadoNoSite: !!site && pg.links.some((l) => l.includes(new URL(site!).hostname.replace(/^www\./, ""))) });
            if (av.conflito) melhor.delete(p.rede);
            else if (av.verificado) melhor.set(p.rede, { ...p, verificado: true, motivos: [...new Set([...av.motivos, "conteúdo do perfil"])] });
          } catch { /* perfil fechado/bloqueado: permanece não confirmado */ }
        }));

        return { site, perfis: [...melhor.values()].map(({ pontos: _p, ...r }) => r) };
      }, { site: null as string | null, perfis: [] as PerfilSocial[] }),

      // 2. Google Maps — estrelas e total, só se o endereço do estabelecimento bater com a cidade
      safe("google", async () => {
        const q = encodeURIComponent(`${nome} ${local}`.trim());
        const r = await fc("/scrape", {
          url: `https://www.google.com/maps/search/${q}`,
          waitFor: 2000,
          location: { country: "BR", languages: ["pt-BR"] },
          formats: [{
            type: "json",
            prompt: `Liste os estabelecimentos visíveis com nome, endereço completo, nota média (estrelas) e total de avaliações. Não invente valores ausentes.`,
            schema: { type: "object", properties: {
              estabelecimentos: { type: "array", items: { type: "object", properties: {
                nome: { type: "string" }, endereco: { type: "string" }, nota: { type: "number" }, total_avaliacoes: { type: "number" },
              } } },
            } },
          }],
        });
        const j = r?.data?.json ?? r?.json ?? {};
        const lista: any[] = Array.isArray(j.estabelecimentos) ? j.estabelecimentos : [];
        const escolhido = lista.find((e) => {
          const t = `${e?.nome ?? ""} ${e?.endereco ?? ""}`;
          return (menciona(t, toks) || menciona(t, toksRazao)) && mencionaCidade(String(e?.endereco ?? ""), data.municipio) && !avaliar(t, alvoBase).conflito;
        });
        const nota = escolhido && typeof escolhido.nota === "number" && escolhido.nota > 0 && escolhido.nota <= 5 ? escolhido.nota : null;
        return {
          nota,
          total: escolhido && typeof escolhido.total_avaliacoes === "number" && escolhido.total_avaliacoes > 0 ? escolhido.total_avaliacoes : null,
          comentarios: [] as { texto: string; estrelas?: number }[],
        };
      }, { nota: null as number | null, total: null as number | null, comentarios: [] as { texto: string; estrelas?: number }[] }),

      // 3. Reclame Aqui
      safe<RA>("reclameaqui", async () => {
        const hits = await search(`"${nome}" reclame aqui reclamações`, 10);
        raHits = hits;
        const alvo = hits.find((h) => /reclameaqui\.com\.br\/empresa\/[^/]+\/?$/.test(h.url) && menciona(`${h.title} ${h.url.replace(/-/g, " ")}`, toks))
          ?? hits.find((h) => /reclameaqui\.com\.br\/empresa\//.test(h.url) && menciona(`${h.title} ${h.url.replace(/-/g, " ")}`, toks));
        if (!alvo) return { url: null, nota: null, reclamacoes: null, respondidas_pct: null, reputacao: null, comentarios: [] as string[] };
        const url = alvo.url.match(/https?:\/\/[^/]+\/empresa\/[^/]+/)![0] + "/";
        const r = await fc("/scrape", {
          url, waitFor: 2000,
          formats: [{
            type: "json",
            prompt: "Extraia nota geral (0-10), total de reclamações, percentual de reclamações respondidas, selo/reputação, títulos das últimas reclamações, CNPJ exibido e cidade/UF da empresa (se visíveis).",
            schema: { type: "object", properties: {
              nota: { type: "number" }, reclamacoes: { type: "number" }, respondidas_pct: { type: "number" },
              reputacao: { type: "string" }, ultimas: { type: "array", items: { type: "string" } },
              cnpj: { type: "string" }, cidade: { type: "string" }, uf: { type: "string" },
            } },
          }],
        });
        const j = r?.data?.json ?? r?.json ?? {};
        // Desambiguação: CNPJ diferente ou localidade conflitante => é outra empresa
        const cnpjPg = String(j.cnpj ?? "").replace(/\D/g, "");
        const vazio = { url: null, nota: null, reclamacoes: null, respondidas_pct: null, reputacao: null, comentarios: [] as string[] };
        if (cnpjPg.length === 14 && cnpjPg !== data.cnpj) return vazio;
        if (cnpjPg !== data.cnpj && (j.cidade || j.uf)) {
          const loc = `${j.cidade ?? ""} - ${String(j.uf ?? "").toUpperCase()}`;
          const ufDiff = j.uf && data.uf && String(j.uf).toUpperCase() !== data.uf.toUpperCase();
          if (ufDiff || (j.cidade && data.municipio && !mencionaCidade(loc, data.municipio))) return vazio;
        }
        return {
          url,
          nota: typeof j.nota === "number" ? j.nota : null,
          reclamacoes: typeof j.reclamacoes === "number" ? j.reclamacoes : null,
          respondidas_pct: typeof j.respondidas_pct === "number" ? j.respondidas_pct : null,
          reputacao: j.reputacao ? String(j.reputacao) : null,
          comentarios: (Array.isArray(j.ultimas) ? j.ultimas : []).slice(0, 6).map(String),
        };
      }, { url: null as string | null, nota: null as number | null, reclamacoes: null as number | null, respondidas_pct: null as number | null, reputacao: null as string | null, comentarios: [] as string[] }),

      // 4. Jurídico — atribuição estrita: CNPJ citado = ALTA; só nome = BAIXA (não pontua)
      safe("juridico", async () => {
        const hits = await search(`"${cnpjFmt}" processo OR jusbrasil OR "diário oficial"`, 15);
        const vistos = new Set<string>();
        const citacoes: Citacao[] = [];
        for (const h of hits) {
          if (vistos.has(h.url)) continue;
          vistos.add(h.url);
          const texto = `${h.title ?? ""} ${h.description ?? ""}`;
          if (!/process|a[cç][aã]o|r[eé]u|reclamad|executad|autos|di[aá]rio oficial|jusbrasil|escavador|tribunal|tj[a-z]{2}|trt|vara/i.test(texto + h.url)) continue;
          const alta = texto.includes(cnpjFmt) || texto.includes(data.cnpj);
          if (!alta && !menciona(texto, toksRazao)) continue;
          citacoes.push({ titulo: (h.title ?? h.url).slice(0, 160), url: h.url, confianca: alta ? "ALTA" : "BAIXA" });
        }
        return citacoes.slice(0, 15);
      }, [] as Citacao[]),

      // 5. Comentários e reclamações na web aberta
    ]);
    const comentWeb2 = (() => {
        return raHits
          .filter((h) => h.description && !/^\s*[#\[]/.test(h.description) && (!social.site || !h.url.includes(new URL(social.site).hostname.replace(/^www\./, "").split(".")[0] ?? "")) && menciona(`${h.title} ${h.description}`, toks) && !avaliar(`${h.title} ${h.description}`, alvoBase).conflito)
          .map((h) => ({ texto: h.description!.slice(0, 280), fonte: new URL(h.url).hostname.replace(/^www\./, "") }));
    })();

        // Consolidação de comentários com classificação determinística
    const comentarios: Comentario[] = [
      ...google.comentarios.map((c) => ({
        texto: c.texto.slice(0, 280), estrelas: typeof c.estrelas === "number" ? c.estrelas : null, fonte: "Google",
        reclamacao: (typeof c.estrelas === "number" && c.estrelas <= 2) || PALAVRAS_RECLAMACAO.test(c.texto),
      })),
      ...reclame.comentarios.map((t: string) => ({ texto: t, estrelas: null, fonte: "Reclame Aqui", reclamacao: true })),
      ...comentWeb2.map((c) => ({ texto: c.texto, estrelas: null, fonte: c.fonte, reclamacao: PALAVRAS_RECLAMACAO.test(c.texto) })),
    ].slice(0, 15);

    // Scoring determinístico dos novos pilares
    const disc: { rotulo: string; delta: number }[] = [];
    const add = (rotulo: string, delta: number) => delta !== 0 && disc.push({ rotulo, delta });

    const verificados = social.perfis.filter((p) => p.verificado).length;
    const presencaFarol: Farol = erros.includes("presenca") ? "NAO_VERIFICADO" : social.site && verificados >= 2 ? "BOM" : social.site || verificados >= 1 ? "ATENCAO" : "CRITICO";
    if (!erros.includes("presenca") && !social.site && verificados === 0) add("Nenhum site ou rede social verificada", -4);

    const alta = juri.filter((c) => c.confianca === "ALTA").length;
    const baixa = juri.length - alta;
    const juriDelta = alta === 0 ? 0 : alta <= 2 ? -4 : alta <= 5 ? -8 : -14;
    add(`${alta} citação(ões) jurídica(s) com CNPJ identificado`, juriDelta);
    const juriFarol: Farol = erros.includes("juridico") ? "NAO_VERIFICADO" : alta === 0 ? "BOM" : alta <= 2 ? "ATENCAO" : "CRITICO";

    let repFarol: Farol = "NAO_VERIFICADO";
    const sinais: string[] = [];
    if (google.nota !== null) {
      sinais.push(`Google ${google.nota.toFixed(1)}★${google.total ? ` (${google.total})` : ""}`);
      if (google.nota < 3) add(`Nota Google baixa (${google.nota.toFixed(1)})`, -8);
      else if (google.nota < 4) add(`Nota Google mediana (${google.nota.toFixed(1)})`, -3);
    }
    if (reclame.nota !== null) {
      sinais.push(`Reclame Aqui ${reclame.nota.toFixed(1)}/10`);
      if (reclame.nota < 5) add(`Reclame Aqui nota baixa (${reclame.nota.toFixed(1)})`, -8);
      else if (reclame.nota < 7) add(`Reclame Aqui nota regular (${reclame.nota.toFixed(1)})`, -3);
    }
    if (google.nota !== null || reclame.nota !== null) {
      const piores = [google.nota !== null ? google.nota * 2 : 10, reclame.nota ?? 10];
      const m = Math.min(...piores);
      repFarol = m >= 7.6 ? "BOM" : m >= 6 ? "ATENCAO" : "CRITICO";
    }
    const qtdRecl = comentarios.filter((c) => c.reclamacao).length;

    const indicadores: Indicador[] = [
      {
        chave: "presenca", titulo: "Presença digital", farol: presencaFarol,
        resumo: `${social.site ? "Site próprio" : "Sem site"} · ${verificados} rede(s) verificada(s) de ${social.perfis.length} encontrada(s)`,
      },
      {
        chave: "processos", titulo: "Risco jurídico", farol: juriFarol,
        resumo: `${alta} citação(ões) com CNPJ · ${baixa} por nome (não pontuam)`,
      },
      {
        chave: "reputacao", titulo: "Reputação de consumo", farol: repFarol,
        resumo: sinais.length ? `${sinais.join(" · ")} · ${qtdRecl} reclamação(ões) nos comentários` : "Nenhuma avaliação pública localizada.",
      },
    ];

    return {
      presenca: social,
      google: { nota: google.nota, total: google.total },
      reclameAqui: { url: reclame.url, nota: reclame.nota, reclamacoes: reclame.reclamacoes, respondidas_pct: reclame.respondidas_pct, reputacao: reclame.reputacao },
      comentarios,
      juridico: { citacoes: juri, alta, baixa },
      indicadores,
      discriminacao: disc,
      erros,
    };
  });
