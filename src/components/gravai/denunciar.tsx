"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { REPORT_REASONS, reportRow, type ReportArea, type ReportReason } from "@/lib/denuncia";
import { cn } from "@/lib/utils";

// Link discreto para denunciar uma resposta da IA (pedido da política da Google Play para apps com IA).
// Fica perto do conteúdo gerado; a folha guarda o trecho como estava na tela.
export function ReportAi({ area, content, refId, label = "Denunciar", className }: { area: ReportArea; content: string; refId?: string | null; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("flex min-h-11 items-center gap-1.5 self-start text-sm text-muted-foreground", className)}>
        <Flag className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        {label}
      </button>
      {open && <ReportSheet area={area} content={content} refId={refId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReportSheet({ area, content, refId, onClose }: { area: ReportArea; content: string; refId?: string | null; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [missing, setMissing] = useState(false);

  async function send() {
    if (!reason) return;
    const row = reportRow({ area, reason, content, note, refId });
    if (!row) {
      setMissing(true);
      return;
    }
    setState("sending");
    const { error } = await createClient().from("ai_reports").insert(row);
    setState(error ? "error" : "sent");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="denunciar-titulo"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-lg flex-col gap-4 rounded-t-3xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-foreground"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="denunciar-titulo" className="text-lg font-bold leading-snug">
            {state === "sent" ? "Recebemos a sua denúncia" : "Denunciar esta resposta da IA"}
          </h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center">
            <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {state === "sent" ? (
          <>
            <p className="leading-relaxed text-muted-foreground">Obrigado por avisar. A equipe do Gravaí vai ler e usar isso para melhorar as respostas.</p>
            <button type="button" onClick={onClose} className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground">
              Fechar
            </button>
          </>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm text-muted-foreground">O que tem de errado?</legend>
              <div className="flex flex-wrap gap-2">
                {REPORT_REASONS.map(([id, text]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={reason === id}
                    onClick={() => setReason(id)}
                    className={cn("min-h-11 rounded-full border border-input bg-card px-4 text-sm font-semibold", reason === id && "border-foreground bg-foreground text-background")}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-2 text-sm text-muted-foreground">
              {reason === "outro" ? "Conte o que aconteceu" : "Quer contar mais? (opcional)"}
              <textarea
                id="denuncia-nota"
                value={note}
                maxLength={500}
                rows={3}
                onChange={(e) => {
                  setNote(e.target.value);
                  setMissing(false);
                }}
                className="rounded-xl border border-input bg-card p-3 text-[15px] text-foreground"
              />
            </label>
            {missing && <p className="text-sm text-destructive">Escreva em poucas palavras o que aconteceu.</p>}
            {state === "error" && <p className="text-sm text-destructive">Não deu para enviar agora. Confira a internet e tente de novo.</p>}
            <button
              type="button"
              disabled={!reason || state === "sending"}
              onClick={send}
              className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40"
            >
              {state === "sending" ? "Enviando…" : "Enviar denúncia"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
