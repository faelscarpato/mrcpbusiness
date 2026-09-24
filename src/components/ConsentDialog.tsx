import { useState } from "react";

export function ConsentDialog({
  cnpj,
  onConfirm,
  onCancel,
}: {
  cnpj: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [aceito, setAceito] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg border border-border bg-surface p-6 shadow-2xl">
        <p className="label-kicker">Consentimento · LGPD</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">
          Antes de analisar {cnpj}
        </h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            A consulta utiliza exclusivamente dados públicos de pessoa jurídica divulgados pela
            Receita Federal, com base legal de legítimo interesse e transparência pública.
          </p>
          <p>
            Nomes de sócios são exibidos apenas quando constam no registro público e nunca recebem
            pontuação negativa por homonímia. Nenhum dado pessoal seu é coletado neste passo.
          </p>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 border border-border bg-surface-raised p-3 text-sm">
          <input
            type="checkbox"
            checked={aceito}
            onChange={(e) => setAceito(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-primary)]"
          />
          <span>Li e concordo com a Política de Privacidade e o tratamento descrito acima.</span>
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onCancel}
            className="border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            disabled={!aceito}
            onClick={onConfirm}
            className="bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Analisar agora
          </button>
        </div>
      </div>
    </div>
  );
}
