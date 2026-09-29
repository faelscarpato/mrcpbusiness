import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { analisarCnpj, notaFromScore, type RelatorioMinimo } from "@/lib/analise.functions";
import { varrerWeb } from "@/lib/varredura.functions";
import { formatCnpj, isValidCnpj } from "@/lib/cnpj";
import { ConsentDialog } from "@/components/ConsentDialog";
import { RelatorioMinimoView } from "@/components/RelatorioMinimo";
import { VarreduraWebView } from "@/components/VarreduraWeb";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Analisador de Empresas | MRCP-Business" },
      {
        name: "description",
        content:
          "Consulte um CNPJ e receba um diagnóstico instantâneo com nota A–F e indicadores de saúde cadastral, risco jurídico, presença digital e reputação.",
      },
      { property: "og:title", content: "Analisador de Empresas | MRCP-Business" },
      {
        property: "og:description",
        content:
          "Diagnóstico determinístico de CNPJ com nota A–F baseada em dados públicos da Receita Federal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const MENSAGENS: Record<string, string> = {
  CNPJ_INVALIDO: "Este CNPJ não passou na validação dos dígitos verificadores.",
  CNPJ_NAO_ENCONTRADO: "Nenhum registro público encontrado para este CNPJ.",
  FONTE_INDISPONIVEL: "A base pública da Receita Federal não respondeu. Tente novamente em instantes.",
};

function Index() {
  const [cnpj, setCnpj] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const analisar = useServerFn(analisarCnpj);
  const varrer = useServerFn(varrerWeb);

  const web = useMutation({
    mutationFn: (r: RelatorioMinimo) =>
      varrer({
        data: {
          cnpj: r.cnpj,
          razao_social: r.razao_social,
          nome_fantasia: r.nome_fantasia,
          municipio: r.municipio,
          uf: r.uf,
        },
      }),
  });

  const mutation = useMutation({
    mutationFn: (valor: string) => analisar({ data: { cnpj: valor } }),
    onMutate: () => web.reset(),
    onSuccess: (r) => web.mutate(r),
  });

  const relatorio = useMemo<RelatorioMinimo | undefined>(() => {
    const r = mutation.data;
    if (!r || !web.data) return r;
    const disc = [...r.discriminacao, ...web.data.discriminacao];
    const score = Math.max(0, Math.min(100, Math.round(r.score_numerico + web.data.discriminacao.reduce((s, d) => s + d.delta, 0))));
    return {
      ...r,
      score_numerico: score,
      nota_global: notaFromScore(score),
      cobertura_analisada: 4,
      discriminacao: disc,
      pontos_atencao: disc.filter((d) => d.delta < 0).length,
      indicadores: r.indicadores.map((i) => web.data!.indicadores.find((w) => w.chave === i.chave) ?? i),
    };
  }, [mutation.data, web.data]);

  const valido = isValidCnpj(cnpj);

  const erro = mutation.error
    ? (MENSAGENS[(mutation.error as Error).message] ??
      "Não foi possível concluir a análise agora.")
    : null;

  return (
    <main className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold tracking-tight text-primary">
              MRCP
            </span>
            <span className="font-mono text-sm tracking-tight text-muted-foreground">
              /business
            </span>
          </div>
          <span className="label-kicker hidden sm:block">Análise determinística de empresas</span>
        </div>
      </header>

      <section className="grid-backdrop border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <p className="label-kicker">Diagnóstico público · Nível 1 gratuito</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Saiba em segundos como o mercado enxerga qualquer empresa brasileira.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Informe um CNPJ e receba uma nota de A a F com quatro faróis macro. O cálculo é
            matemático e auditável — sem inferência de modelo de linguagem, sem alucinação.
          </p>

          <form
            className="mt-10 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              if (valido) setConsentOpen(true);
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={cnpj}
                onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                aria-label="CNPJ da empresa"
                className="flex-1 border border-input bg-surface px-4 py-3.5 font-mono text-base outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring"
              />
              <button
                type="submit"
                disabled={!valido || mutation.isPending}
                className="bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                {mutation.isPending ? "Analisando…" : "Analisar CNPJ"}
              </button>
            </div>
            {cnpj.length >= 18 && !valido && (
              <p className="mt-2 text-sm text-signal-bad">
                Dígitos verificadores inválidos para este CNPJ.
              </p>
            )}
            {erro && <p className="mt-2 text-sm text-signal-bad">{erro}</p>}
          </form>
        </div>
      </section>

      <section className="px-6 py-12 sm:py-16">
        {mutation.isPending && (
          <div className="mx-auto max-w-4xl border border-border bg-surface p-8">
            <p className="label-kicker">Processando</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Consultando a base cadastral e executando o motor de pontuação…
            </p>
            <div className="mt-4 h-1 w-full overflow-hidden bg-surface-raised">
              <div className="h-full w-1/3 animate-pulse bg-primary" />
            </div>
          </div>
        )}

        {relatorio && !mutation.isPending && <RelatorioMinimoView r={relatorio} />}
        {relatorio && web.isPending && (
          <div className="mx-auto mt-4 max-w-4xl border border-border bg-surface p-6">
            <p className="label-kicker">Varredura web em andamento</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Buscando redes sociais, avaliações no Google, Reclame Aqui e citações jurídicas… (até 60s)
            </p>
            <div className="mt-4 h-1 w-full overflow-hidden bg-surface-raised">
              <div className="h-full w-1/3 animate-pulse bg-primary" />
            </div>
          </div>
        )}
        {web.isError && (
          <p className="mx-auto mt-4 max-w-4xl text-sm text-signal-warn">
            A varredura web não pôde ser concluída agora. A nota reflete apenas o pilar cadastral.
          </p>
        )}
        {web.data && <VarreduraWebView v={web.data} />}

        {!mutation.data && !mutation.isPending && (
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-px bg-border sm:grid-cols-3">
            {[
              {
                t: "Cadastral e societário",
                d: "Situação na Receita, idade do negócio, CNAE, porte e quadro de sócios.",
              },
              {
                t: "Atribuição estrita",
                d: "Apontamentos de sócios sem correlação comprovada nunca deduzem pontos da empresa.",
              },
              {
                t: "Processamento local",
                d: "Parsers determinísticos em vez de tokens: custo previsível e resultado reproduzível.",
              },
            ].map((c) => (
              <div key={c.t} className="bg-surface p-6">
                <h3 className="text-sm font-semibold">{c.t}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Dados cadastrais públicos da Receita Federal, obtidos por fontes redundantes. Diagnóstico
            informativo, sem caráter de certidão ou parecer jurídico.
          </p>
        </div>
      </footer>

      {consentOpen && (
        <ConsentDialog
          cnpj={cnpj}
          onCancel={() => setConsentOpen(false)}
          onConfirm={() => {
            setConsentOpen(false);
            mutation.mutate(cnpj);
          }}
        />
      )}
    </main>
  );
}
