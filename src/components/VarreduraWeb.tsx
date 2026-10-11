import type { Varredura } from "@/lib/varredura.functions";

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-surface p-6 sm:p-8">
      <p className="label-kicker">{titulo}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function VarreduraWebView({ v }: { v: Varredura }) {
  return (
    <div className="mx-auto mt-4 grid w-full max-w-4xl grid-cols-1 gap-4">
      <Bloco titulo="Presença digital">
        {v.presenca.site && (
          <a href={v.presenca.site} target="_blank" rel="noreferrer" className="block text-sm text-primary underline-offset-4 hover:underline">
            {v.presenca.site}
          </a>
        )}
        {v.presenca.perfis.length === 0 && !v.presenca.site ? (
          <p className="text-sm text-muted-foreground">Nenhum canal digital localizado.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {v.presenca.perfis.map((p) => (
              <li key={p.url} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-b-0">
                <a href={p.url} target="_blank" rel="noreferrer" className="truncate hover:text-primary">
                  <span className="font-semibold">{p.rede}</span>{" "}
                  <span className="text-muted-foreground">{p.url.replace(/^https:\/\//, "")}</span>
                </a>
                <span className="flex shrink-0 flex-col items-end">
                  <span className={`font-mono text-[0.65rem] uppercase tracking-widest ${p.verificado ? "text-signal-good" : "text-signal-warn"}`}>
                    {p.verificado ? "Verificado" : "Não confirmado"}
                  </span>
                  {p.motivos?.length > 0 && (
                    <span className="text-[0.65rem] text-muted-foreground">{p.motivos.join(" · ")}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco titulo="Avaliações e reclamações">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><p className="label-kicker">Google</p><p className="mt-1 font-mono text-xl">{v.google.nota !== null ? `${v.google.nota.toFixed(1)}★` : "—"}</p></div>
          <div><p className="label-kicker">Avaliações</p><p className="mt-1 font-mono text-xl">{v.google.total ?? "—"}</p></div>
          <div><p className="label-kicker">Reclame Aqui</p><p className="mt-1 font-mono text-xl">{v.reclameAqui.nota !== null ? `${v.reclameAqui.nota.toFixed(1)}/10` : "—"}</p></div>
          <div><p className="label-kicker">Reclamações</p><p className="mt-1 font-mono text-xl">{v.reclameAqui.reclamacoes ?? "—"}</p></div>
        </div>
        {v.reclameAqui.reputacao && (
          <p className="mt-3 text-xs text-muted-foreground">
            Reputação: {v.reclameAqui.reputacao}
            {v.reclameAqui.respondidas_pct !== null ? ` · ${v.reclameAqui.respondidas_pct}% respondidas` : ""}
          </p>
        )}
        {v.comentarios.length > 0 && (
          <ul className="mt-4 space-y-3">
            {v.comentarios.map((c, i) => (
              <li key={i} className="border-l-2 pl-3 text-sm" style={{ borderColor: c.reclamacao ? "var(--color-signal-bad)" : "var(--color-border)" }}>
                <p className="text-foreground">{c.texto}</p>
                <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  {c.fonte}{c.estrelas !== null ? ` · ${c.estrelas}★` : ""}{c.reclamacao ? " · reclamação" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco titulo="Citações jurídicas">
        {v.juridico.citacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma citação em processos ou diários oficiais localizada.</p>
        ) : (
          <ul className="space-y-2">
            {v.juridico.citacoes.map((c) => (
              <li key={c.url} className="flex items-start justify-between gap-3 border-b border-border pb-2 text-sm last:border-b-0">
                <a href={c.url} target="_blank" rel="noreferrer" className="hover:text-primary">{c.titulo}</a>
                <span className={`shrink-0 font-mono text-[0.65rem] uppercase tracking-widest ${c.confianca === "ALTA" ? "text-signal-bad" : "text-signal-unknown"}`}>
                  {c.confianca === "ALTA" ? "CNPJ citado" : "Só nome"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Atribuição estrita: apenas citações com o CNPJ identificado reduzem a nota. Menções só pelo nome podem ser homônimos.
        </p>
      </Bloco>

      {v.erros.length > 0 && (
        <p className="text-xs text-signal-warn">Algumas fontes não responderam: {v.erros.join(", ")}.</p>
      )}
    </div>
  );
}
