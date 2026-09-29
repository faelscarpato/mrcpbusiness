import type { Farol, RelatorioMinimo as Relatorio } from "@/lib/analise.functions";
import { formatCnpj } from "@/lib/cnpj";

const FAROL_STYLE: Record<Farol, { dot: string; texto: string; rotulo: string }> = {
  BOM: { dot: "bg-signal-good", texto: "text-signal-good", rotulo: "Bom" },
  ATENCAO: { dot: "bg-signal-warn", texto: "text-signal-warn", rotulo: "Atenção" },
  CRITICO: { dot: "bg-signal-bad", texto: "text-signal-bad", rotulo: "Crítico" },
  NAO_VERIFICADO: {
    dot: "bg-signal-unknown",
    texto: "text-signal-unknown",
    rotulo: "Não verificado",
  },
};

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="border-t border-border py-3">
      <p className="label-kicker">{rotulo}</p>
      <p className="mt-1 text-sm text-foreground">{valor}</p>
    </div>
  );
}

export function RelatorioMinimoView({ r }: { r: Relatorio }) {
  const moeda =
    r.capital_social !== null
      ? r.capital_social.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "Não informado";

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="border border-border bg-surface">
        <div className="flex flex-col gap-6 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="min-w-0">
            <p className="label-kicker">Relatório mínimo · Nível 1</p>
            <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight">
              {r.razao_social}
            </h2>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {formatCnpj(r.cnpj)}
              {r.municipio ? ` · ${r.municipio}/${r.uf}` : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <div className="flex size-20 items-center justify-center border border-primary/40 bg-primary/10">
              <span className="font-mono text-4xl font-semibold text-primary">{r.nota_global}</span>
            </div>
            <div>
              <p className="label-kicker">Score</p>
              <p className="font-mono text-2xl">{r.score_numerico}/100</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.pontos_atencao} ponto(s) de atenção
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {r.indicadores.map((i) => {
            const s = FAROL_STYLE[i.farol];
            return (
              <div key={i.chave} className="border-b border-border p-5 lg:border-b-0 lg:border-r last:lg:border-r-0">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${s.dot}`} />
                  <span className={`font-mono text-[0.65rem] uppercase tracking-widest ${s.texto}`}>
                    {s.rotulo}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold">{i.titulo}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{i.resumo}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-x-8 px-6 pb-6 sm:grid-cols-2 sm:px-8 sm:pb-8">
          <Campo rotulo="Situação cadastral" valor={r.situacao} />
          <Campo
            rotulo="Abertura"
            valor={
              r.data_abertura
                ? `${new Date(r.data_abertura).toLocaleDateString("pt-BR")} · ${r.idade_anos} ano(s)`
                : "Não informada"
            }
          />
          <Campo rotulo="Nome fantasia" valor={r.nome_fantasia ?? "Não informado"} />
          <Campo rotulo="Porte" valor={r.porte ?? "Não informado"} />
          <Campo
            rotulo="CNAE principal"
            valor={r.cnae_principal ? `${r.cnae_principal.codigo} — ${r.cnae_principal.descricao}` : "—"}
          />
          <Campo rotulo="Capital social" valor={moeda} />
          <Campo rotulo="Sócios e administradores" valor={`${r.qtd_socios} registrado(s)`} />
          <Campo
            rotulo="Quadro societário"
            valor={
              r.socios_resumo.length
                ? r.socios_resumo.map((s) => s.nome).join(" · ")
                : "Não divulgado"
            }
          />
        </div>
      </div>

      <div className="mt-4 border border-border bg-surface p-6 sm:p-8">
        <p className="label-kicker">Discriminação do score</p>
        <ul className="mt-3 space-y-2">
          {r.discriminacao.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              Nenhuma dedução aplicada sobre o pilar cadastral.
            </li>
          ) : (
            r.discriminacao.map((d) => (
              <li
                key={d.rotulo}
                className="flex items-center justify-between gap-4 border-b border-border pb-2 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">{d.rotulo}</span>
                <span
                  className={`font-mono ${d.delta < 0 ? "text-signal-bad" : "text-signal-good"}`}
                >
                  {d.delta > 0 ? `+${d.delta}` : d.delta}
                </span>
              </li>
            ))
          )}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {r.cobertura_analisada > 1
            ? "Score composto pelos pilares cadastral, presença digital, risco jurídico e reputação de consumo."
            : "Score parcial: apenas o pilar cadastral. Os demais pilares são somados ao fim da varredura web."}
        </p>
      </div>

      <div className="mt-4 border border-primary/30 bg-primary/5 p-6 sm:p-8">
        <p className="label-kicker">Próximo nível</p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight">
          Relatório estendido e dossiê 360°
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Volumetria de processos, índices de reclamação, canais sociais mapeados e benchmark
          setorial ficam disponíveis nos níveis seguintes do MRCP-Business.
        </p>
      </div>
    </div>
  );
}
