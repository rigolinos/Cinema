import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { ANGLES, FRAMINGS, MOVEMENTS, type Angle, type Framing, type Movement } from "@/lib/planos";
import { BLOCK_KINDS, type BlockKind } from "@/lib/roteiro";
import { ROLES, formatShootDate, type PersonRole } from "@/lib/pessoas";
import { PartActions } from "./actions";

// Link pessoal: ninguém deve achar por busca.
export const metadata: Metadata = {
  title: "Seu convite para gravar · Gravaí",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface Part {
  person: { name: string; role: PersonRole; confirmed: boolean };
  video: { title: string; shoot_date: string | null; shoot_place: string | null; platform: string | null };
  creator: string | null; // nome completo de quem convidou; sem ele, o termo de imagem não pode ser aceito
  consented: boolean;
  blocks: { number: number; kind: BlockKind; label: string | null; speech: string; on_screen: string; action: string; mine: boolean }[];
  shots: { block: number; framing: Framing; angle: Angle; movement: Movement; orientation: string; description: string; location: string; wardrobe: string; why: string }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 py-8">
      <Logo className="text-2xl" />
      <div className="flex flex-col gap-2 rounded-2xl bg-card p-5">
        <h1 className="text-xl font-bold">Este link não está mais ativo</h1>
        <p className="leading-relaxed text-muted-foreground">Ele pode ter sido desligado por quem te convidou. Peça um link novo para essa pessoa.</p>
      </div>
    </div>
  );
}

export default async function SharedPartPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) return <NotFound />;

  const supabase = await createClient();
  const { data } = await supabase.rpc("shared_part", { p_token: token });
  const part = data as Part | null;
  if (!part) return <NotFound />;

  const isCrew = part.person.role !== "ator";
  const date = formatShootDate(part.video.shoot_date);
  const firstName = part.person.name.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 pb-16 pt-6">
      <Logo className="text-2xl" />

      <header className="flex flex-col gap-2">
        <p className="label-set text-muted-foreground">{part.creator ? `Convite de ${part.creator}` : "Convite para gravar"}</p>
        <h1 className="font-display text-[30px]">Oi, {firstName}.</h1>
        <p className="leading-relaxed">
          Te chamaram {ROLES[part.person.role].as} em <strong>“{part.video.title}”</strong>.{" "}
          {isCrew ? "Aqui estão o roteiro e os planos, na ordem de gravação." : "Aqui estão as suas falas e cenas, para você treinar."}
        </p>
      </header>

      {(date || part.video.shoot_place) && (
        <section aria-label="Quando e onde" className="flex flex-col gap-1 rounded-2xl border-[1.5px] border-foreground p-4">
          <span className="label-set text-muted-foreground">Gravação</span>
          {date && <p className="text-lg font-bold first-letter:uppercase">{date}</p>}
          {part.video.shoot_place && <p className="leading-relaxed">{part.video.shoot_place}</p>}
        </section>
      )}

      <PartActions token={token} creator={part.creator} title={part.video.title} confirmed={part.person.confirmed} consented={part.consented} needsConsent={part.person.role === "ator"} />

      {!isCrew && (
        <section aria-labelledby="falas" className="flex flex-col gap-3">
          <h2 id="falas" className="label-set">
            Suas falas
          </h2>
          {part.blocks.length === 0 && (
            <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Ainda não tem fala sua marcada no roteiro. Quando tiver, aparece aqui.</p>
          )}
          {part.blocks.map((b) => (
            <article key={b.number} className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
              <span className="label-set text-muted-foreground">
                Parte {String(b.number).padStart(2, "0")} · {b.label || BLOCK_KINDS[b.kind].label}
              </span>
              {b.speech && <p className="text-xl font-semibold leading-snug">{b.speech}</p>}
              {b.action && <p className="text-sm leading-relaxed text-muted-foreground">Cena: {b.action}</p>}
            </article>
          ))}
        </section>
      )}

      {isCrew && (
        <>
          <section aria-labelledby="planos" className="flex flex-col gap-3">
            <h2 id="planos" className="label-set">
              Planos, na ordem de gravação
            </h2>
            {part.shots.length === 0 && <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Os planos ainda não foram montados.</p>}
            {part.shots.map((s, i) => (
              <article key={i} className="flex flex-col gap-2 rounded-2xl bg-card p-4">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(i + 1).padStart(2, "0")} · PARTE {String(s.block).padStart(2, "0")}
                  {s.location ? ` · ${s.location.toUpperCase()}` : ""}
                </span>
                <p className="font-bold leading-snug">{s.description || FRAMINGS[s.framing]?.label}</p>
                <p className="font-mono text-xs uppercase">
                  {[FRAMINGS[s.framing]?.label, ANGLES[s.angle]?.label, MOVEMENTS[s.movement]?.label, s.orientation].join(" · ")}
                </p>
                {s.why && <p className="text-sm leading-relaxed text-muted-foreground">Por quê: {s.why}</p>}
              </article>
            ))}
          </section>
          <section aria-labelledby="roteiro" className="flex flex-col gap-3">
            <h2 id="roteiro" className="label-set">
              Roteiro
            </h2>
            {part.blocks.map((b) => (
              <article key={b.number} className="flex flex-col gap-1.5 rounded-2xl bg-card p-4">
                <span className="label-set text-muted-foreground">
                  Parte {String(b.number).padStart(2, "0")} · {b.label || BLOCK_KINDS[b.kind].label}
                </span>
                {b.speech && <p className="leading-relaxed">{b.speech}</p>}
                {b.on_screen && <p className="text-sm text-muted-foreground">Na tela: {b.on_screen}</p>}
              </article>
            ))}
          </section>
        </>
      )}

      <footer className="pt-4 text-center text-xs text-muted-foreground">
        Feito com o Gravaí · este link é só seu, não compartilhe
      </footer>
    </div>
  );
}
