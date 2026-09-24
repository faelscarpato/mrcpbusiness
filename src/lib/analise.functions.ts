import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isValidCnpj, onlyDigits } from "./cnpj";

export type Farol = "BOM" | "ATENCAO" | "CRITICO" | "NAO_VERIFICADO";

export type Indicador = {
  chave: "cadastral" | "presenca" | "processos" | "reputacao";
  titulo: string;
  farol: Farol;
  resumo: string;
};

export type Socio = { nome: string; qualificacao: string };

export type RelatorioMinimo = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao: string;
  data_abertura: string | null;
  idade_anos: number | null;
  porte: string | null;
  uf: string | null;
  municipio: string | null;
  cnae_principal: { codigo: string; descricao: string } | null;
  capital_social: number | null;
  qtd_socios: number;
  socios_resumo: Socio[];
  nota_global: "A" | "B" | "C" | "D" | "E" | "F";
  score_numerico: number;
  cobertura_analisada: number;
  indicadores: Indicador[];
  pontos_atencao: number;
  discriminacao: { rotulo: string; delta: number }[];
  gerado_em: string;
};

type BrasilApiCnpj = {
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  capital_social?: number;
  porte?: string;
  uf?: string;
  municipio?: string;
  cnae_fiscal?: number | string;
  cnae_fiscal_descricao?: string;
  qsa?: { nome_socio?: string; nome?: string; qualificacao_socio?: string }[];
};

function notaFromScore(score: number): RelatorioMinimo["nota_global"] {
  if (score >= 90) return "A";
  if (score >= 78) return "B";
  if (score >= 64) return "C";
  if (score >= 50) return "D";
  if (score >= 35) return "E";
  return "F";
}

export const analisarCnpj = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ cnpj: z.string().min(11).max(20) }).parse(data))
  .handler(async ({ data }): Promise<RelatorioMinimo> => {
    const cnpj = onlyDigits(data.cnpj);
    if (!isValidCnpj(cnpj)) throw new Error("CNPJ_INVALIDO");

    // Redundância de fontes públicas: BrasilAPI -> ReceitaWS
    let raw: BrasilApiCnpj | null = null;
    let naoEncontrado = false;

    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        headers: { accept: "application/json" },
      });
      if (res.status === 404) naoEncontrado = true;
      else if (res.ok) raw = (await res.json()) as BrasilApiCnpj;
      else console.error("brasilapi status", res.status);
    } catch (e) {
      console.error("brasilapi fetch falhou", e);
    }

    if (!raw && !naoEncontrado) {
      try {
        const res = await fetch(`https://open.cnpja.com/office/${cnpj}`, {
          headers: { accept: "application/json" },
        });
        if (res.status === 404) naoEncontrado = true;
        else if (res.ok) {
          const o = (await res.json()) as Record<string, any>;
          raw = {
            razao_social: o['company']?.name,
            nome_fantasia: o['alias'] ?? undefined,
            descricao_situacao_cadastral: o['status']?.text,
            data_inicio_atividade: o['founded'],
            capital_social: o['company']?.equity,
            porte: o['company']?.size?.text,
            uf: o['address']?.state,
            municipio: o['address']?.city,
            cnae_fiscal: o['mainActivity']?.id,
            cnae_fiscal_descricao: o['mainActivity']?.text,
            qsa: (o['company']?.members ?? []).map((m: any) => ({
              nome_socio: m?.person?.name,
              qualificacao_socio: m?.role?.text,
            })),
          };
        } else console.error("cnpja status", res.status);
      } catch (e) {
        console.error("cnpja fetch falhou", e);
      }
    }

    if (naoEncontrado) throw new Error("CNPJ_NAO_ENCONTRADO");
    if (!raw) throw new Error("FONTE_INDISPONIVEL");

    const situacao: string = String(raw.descricao_situacao_cadastral ?? "DESCONHECIDA").toUpperCase();
    const abertura: string | null = raw.data_inicio_atividade ?? null;

    let idade: number | null = null;
    if (abertura) {
      const d = new Date(abertura);
      if (!Number.isNaN(d.getTime())) {
        idade = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
      }
    }

    const capital = typeof raw.capital_social === "number" ? raw.capital_social : null;
    const qsa = Array.isArray(raw.qsa) ? raw.qsa : [];

    // Scoring determinístico — pilar cadastral (único verificável nesta fase)
    const discriminacao: { rotulo: string; delta: number }[] = [];
    let score = 100;

    const ativa = situacao === "ATIVA";
    if (!ativa) {
      const grave = /BAIXADA|INAPTA|SUSPENSA|NULA/.test(situacao);
      const delta = grave ? -45 : -20;
      score += delta;
      discriminacao.push({ rotulo: `Situação cadastral: ${situacao}`, delta });
    }

    if (idade === null) {
      discriminacao.push({ rotulo: "Data de abertura indisponível", delta: -5 });
      score -= 5;
    } else if (idade < 1) {
      discriminacao.push({ rotulo: "CNPJ com menos de 1 ano", delta: -12 });
      score -= 12;
    } else if (idade < 3) {
      discriminacao.push({ rotulo: "CNPJ com menos de 3 anos", delta: -6 });
      score -= 6;
    } else if (idade >= 10) {
      discriminacao.push({ rotulo: "Mais de 10 anos de atividade", delta: +4 });
      score += 4;
    }

    if (capital !== null && capital < 1000) {
      discriminacao.push({ rotulo: "Capital social declarado muito baixo", delta: -6 });
      score -= 6;
    }

    if (qsa.length === 0 && raw.porte !== "MICRO EMPRESA") {
      discriminacao.push({ rotulo: "Quadro societário não divulgado", delta: -3 });
      score -= 3;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    const farolCadastral: Farol = ativa
      ? score >= 85
        ? "BOM"
        : "ATENCAO"
      : /BAIXADA|INAPTA|NULA/.test(situacao)
        ? "CRITICO"
        : "ATENCAO";

    const indicadores: Indicador[] = [
      {
        chave: "cadastral",
        titulo: "Saúde cadastral",
        farol: farolCadastral,
        resumo: `${situacao}${idade !== null ? ` · ${idade} ano(s) de atividade` : ""}`,
      },
      {
        chave: "presenca",
        titulo: "Presença digital",
        farol: "NAO_VERIFICADO",
        resumo: "Varredura de site e redes sociais não executada nesta fase.",
      },
      {
        chave: "processos",
        titulo: "Risco jurídico",
        farol: "NAO_VERIFICADO",
        resumo: "Coleta de processos e diários oficiais não executada nesta fase.",
      },
      {
        chave: "reputacao",
        titulo: "Reputação de consumo",
        farol: "NAO_VERIFICADO",
        resumo: "Índices de reclamação não executados nesta fase.",
      },
    ];

    return {
      cnpj,
      razao_social: raw.razao_social ?? "—",
      nome_fantasia: raw.nome_fantasia || null,
      situacao,
      data_abertura: abertura,
      idade_anos: idade,
      porte: raw.porte ?? null,
      uf: raw.uf ?? null,
      municipio: raw.municipio ?? null,
      cnae_principal: raw.cnae_fiscal
        ? { codigo: String(raw.cnae_fiscal), descricao: raw.cnae_fiscal_descricao ?? "—" }
        : null,
      capital_social: capital,
      qtd_socios: qsa.length,
      socios_resumo: qsa.slice(0, 4).map((s) => ({
        nome: String(s.nome_socio ?? s.nome ?? "—"),
        qualificacao: String(s.qualificacao_socio ?? "—"),
      })),
      nota_global: notaFromScore(score),
      score_numerico: score,
      cobertura_analisada: 1,
      indicadores,
      pontos_atencao: discriminacao.filter((d) => d.delta < 0).length,
      discriminacao,
      gerado_em: new Date().toISOString(),
    };
  });
