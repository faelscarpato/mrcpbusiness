// Desambiguação determinística de homônimos: decide se um resultado da web
// pertence à empresa do CNPJ usando nome, cidade, UF, CNPJ e vínculo com o site oficial.

export const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const STOP = new Set(["ltda", "s/a", "sa", "me", "eireli", "epp", "de", "da", "do", "dos", "das", "e", "comercio", "servicos", "industria"]);
export function tokens(nome: string) {
  return norm(nome).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));
}
export function menciona(texto: string, toks: string[]) {
  const t = norm(texto);
  const hits = toks.filter((k) => t.includes(k)).length;
  return toks.length > 0 && hits >= Math.min(2, toks.length);
}

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const UF_NOMES: Record<string, string> = {
  AC:"acre",AL:"alagoas",AP:"amapa",AM:"amazonas",BA:"bahia",CE:"ceara",DF:"distrito federal",ES:"espirito santo",GO:"goias",MA:"maranhao",MT:"mato grosso",MS:"mato grosso do sul",MG:"minas gerais",PA:"para",PB:"paraiba",PR:"parana",PE:"pernambuco",PI:"piaui",RJ:"rio de janeiro",RN:"rio grande do norte",RS:"rio grande do sul",RO:"rondonia",RR:"roraima",SC:"santa catarina",SP:"sao paulo",SE:"sergipe",TO:"tocantins",
};

export type Alvo = {
  toksNome: string[];
  toksRazao: string[];
  municipio: string | null;
  uf: string | null;
  cnpj: string; // 14 dígitos
  siteHost?: string | null;
};

/** UFs explicitamente citadas no texto em formatos "Cidade - SP", "Cidade/SP", ", SP". */
export function ufsCitadas(texto: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(`(?:[-/,–|(]\\s*)(${UFS.join("|")})\\b`, "g");
  for (const m of texto.matchAll(re)) out.add(m[1]);
  return [...out];
}

export function mencionaCidade(texto: string, municipio: string | null) {
  if (!municipio) return false;
  const c = norm(municipio).trim();
  if (c.length < 3) return false;
  const t = norm(texto);
  return new RegExp(`(^|[^a-z])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(t)
    || t.replace(/\s+/g, "").includes(c.replace(/\s+/g, "")) && c.length >= 6;
}

export type Avaliacao = { pontos: number; verificado: boolean; conflito: boolean; motivos: string[] };

/**
 * Pontuação de pertencimento:
 *  +2 nome · +1 razão social · +3 cidade · +1 UF · +6 CNPJ · +5 vinculado ao site oficial
 *  conflito (cita outra UF e não cita a cidade/UF alvo) => nunca verificado.
 * Verificado exige nome + (cidade ou CNPJ ou vínculo com site oficial).
 */
export function avaliar(texto: string, alvo: Alvo, opts: { linkadoNoSite?: boolean } = {}): Avaliacao {
  const motivos: string[] = [];
  let pontos = 0;
  const nomeOk = menciona(texto, alvo.toksNome);
  const razaoOk = menciona(texto, alvo.toksRazao);
  if (nomeOk) { pontos += 2; motivos.push("nome"); }
  if (razaoOk) { pontos += 1; if (!nomeOk) motivos.push("razão social"); }
  const digits = texto.replace(/\D/g, "");
  const cnpjOk = digits.includes(alvo.cnpj);
  if (cnpjOk) { pontos += 6; motivos.push("CNPJ"); }
  const cidadeOk = mencionaCidade(texto, alvo.municipio);
  if (cidadeOk) { pontos += 3; motivos.push("cidade"); }
  const ufs = ufsCitadas(texto);
  const ufAlvo = alvo.uf?.toUpperCase() ?? null;
  const ufOk = !!ufAlvo && (ufs.includes(ufAlvo) || norm(texto).includes(UF_NOMES[ufAlvo] ?? "\u0000"));
  if (ufOk) { pontos += 1; motivos.push("UF"); }
  if (opts.linkadoNoSite) { pontos += 5; motivos.push("link no site oficial"); }
  const outraUf = !!ufAlvo && ufs.some((u) => u !== ufAlvo);
  const conflito = outraUf && !cidadeOk && !ufOk && !cnpjOk && !opts.linkadoNoSite;
  if (conflito) motivos.push(`outra localidade (${ufs.join(", ")})`);
  const identidade = nomeOk || razaoOk || cnpjOk;
  const ancora = cidadeOk || cnpjOk || !!opts.linkadoNoSite;
  return { pontos, verificado: !conflito && identidade && ancora, conflito, motivos };
}
