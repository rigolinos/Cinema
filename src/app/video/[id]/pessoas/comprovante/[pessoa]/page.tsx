"use client";

import { use, useEffect, useState } from "react";
import { ChevronLeft, Printer } from "lucide-react";
import { BackLink } from "@/components/gravai/voltar";
import { createClient } from "@/lib/supabase/client";
import { consentCode, consentRecordText, type ConsentRecord } from "@/lib/pessoas";

const WHEN = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

// Comprovante da autorização de uso de imagem: uma folha para o dono do vídeo salvar em PDF ou imprimir.
// Só o dono lê o registro (regra do banco); não há link público para ele.
export default function ComprovantePage({ params }: { params: Promise<{ id: string; pessoa: string }> }) {
  const { id, pessoa } = use(params);
  const [record, setRecord] = useState<ConsentRecord | null | undefined>(undefined);
  const [code, setCode] = useState("");

  useEffect(() => {
    createClient()
      .from("image_consents")
      .select("id, accepted_name, accepted_at, video_title, creator_name, text_version, accepted_text")
      .eq("video_id", id)
      .eq("person_id", pessoa)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        const r = (data as ConsentRecord | null) ?? null;
        setRecord(r);
        if (r) setCode(await consentCode(r));
      });
  }, [id, pessoa]);

  const text = record ? consentRecordText(record) : null;
  const rows: [string, string][] = record
    ? [
        ["Quem autorizou", `${record.accepted_name} (nome digitado ao aceitar)`],
        ["Para", record.creator_name ?? "Quem convidou"],
        ["Vídeo", record.video_title],
        ["Data e hora", `${WHEN.format(new Date(record.accepted_at))} (horário de Brasília)`],
        ["Versão do termo", record.text_version],
        ["Código", code],
      ]
    : [];

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-5 pb-12 pt-4 print:max-w-none print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <BackLink href={`/video/${id}/pessoas`} className="-ml-3 flex min-h-11 items-center gap-1 px-2 text-sm font-semibold">
          <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
          Pessoas
        </BackLink>
        {record && (
          <button type="button" onClick={() => window.print()} className="flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-foreground px-4 text-sm font-semibold">
            <Printer className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Salvar em PDF
          </button>
        )}
      </div>

      {record === undefined && <p className="label-set text-muted-foreground">Carregando…</p>}
      {record === null && <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Não há autorização de uso de imagem registrada para esta pessoa neste vídeo.</p>}

      {record && (
        <article className="flex flex-col gap-4 rounded-2xl bg-card p-5 print:rounded-none print:bg-transparent print:p-0">
          <header className="flex flex-col gap-1">
            <h1 className="text-xl font-bold">Autorização de uso de imagem</h1>
            <p className="text-sm text-muted-foreground">Registrada pelo Gravaí</p>
          </header>

          <dl className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-border pt-4 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className={k === "Código" ? "font-mono" : "break-words"}>{v}</dd>
              </div>
            ))}
          </dl>

          <section className="flex flex-col gap-2 border-t border-border pt-4" aria-labelledby="texto-aceito">
            <h2 id="texto-aceito" className="text-sm text-muted-foreground">
              Texto aceito
            </h2>
            {text ? (
              text.split("\n").map((p) => (
                <p key={p} className="text-[15px] leading-relaxed">
                  {p}
                </p>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Texto da versão {record.text_version} não disponível.</p>
            )}
            <p className="text-sm">Para aceitar, a pessoa marcou: “Tenho 18 anos ou mais”.</p>
          </section>

          <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            Aceite feito pelo link pessoal do convite, sem conta, com o nome completo digitado pela pessoa. O registro não pode ser alterado depois. O código resume este registro: qualquer mudança nos dados acima gera outro código.
          </p>
        </article>
      )}
    </div>
  );
}
