import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { myLines, speechLines } from "@/lib/convidado";
import { BLOCK_KINDS, type BlockKind } from "@/lib/roteiro";
import { formatShootDate, rolesAs, type GuestRole, type PersonRole } from "@/lib/pessoas";
import { Acompanhar, type GuestShot } from "./acompanhar";
import { PartActions } from "./actions";

// Link pessoal: ninguém deve achar por busca.
export const metadata: Metadata = {
  title: "Seu convite para gravar · Gravaí",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface Part {
  person: { name: string; role: PersonRole; roles?: GuestRole[]; confirmed: boolean };
  video: { title: string; shoot_date: string | null; shoot_place: string | null; platform: string | null };
  creator: string | null; // nome completo de quem convidou; sem ele, o termo de imagem não pode ser aceito
  consented: boolean;
  // Quem só atua recebe só as partes em que aparece, com a deixa (última fala da parte anterior).
  blocks: { number: number; kind: BlockKind; label: string | null; speech: string; on_screen: string; action: string; mine: boolean; cue?: string | null }[];
  shots: GuestShot[]; // todos os planos, na ordem de gravação, com o que já foi gravado
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

  const roles: GuestRole[] = part.person.roles?.length ? part.person.roles : [part.person.role as GuestRole];
  const appears = roles.includes("ator");
  const films = roles.includes("filma");
  const isCrew = roles.some((r) => r !== "ator");
  const date = formatShootDate(part.video.shoot_date);
  const firstName = part.person.name.trim().split(/\s+/)[0];
  const lines = appears ? myLines(part.blocks.map((b) => ({ ...b, cue: b.cue ?? null })), part.person.name) : [];
  const scenes = Object.fromEntries(part.blocks.map((b) => [b.number, speechLines(b.speech).map((l) => l.raw)]));

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 pb-16 pt-6">
      <Logo className="text-2xl" />

      <header className="flex flex-col gap-2">
        <p className="label-set text-muted-foreground">{part.creator ? `Convite de ${part.creator}` : "Convite para gravar"}</p>
        <h1 className="font-display text-[30px]">Oi, {firstName}.</h1>
        <p className="leading-relaxed">
          Te chamaram {rolesAs(roles)} em <strong>“{part.video.title}”</strong>.
        </p>
      </header>

      {(date || part.video.shoot_place) && (
        <section aria-label="Quando e onde" className="flex flex-col gap-1 rounded-2xl border-[1.5px] border-foreground p-4">
          <span className="label-set text-muted-foreground">Gravação</span>
          {date && <p className="text-lg font-bold first-letter:uppercase">{date}</p>}
          {part.video.shoot_place && <p className="leading-relaxed">{part.video.shoot_place}</p>}
        </section>
      )}

      <PartActions token={token} creator={part.creator} title={part.video.title} confirmed={part.person.confirmed} consented={part.consented} needsConsent={appears} />

      {appears && (
        <section aria-labelledby="falas" className="flex flex-col gap-3">
          <h2 id="falas" className="label-set">
            Suas falas{lines.length > 0 ? ` · ${lines.length}` : ""}
          </h2>
          {lines.length === 0 && (
            <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Ainda não tem fala sua marcada no roteiro. Quando tiver, aparece aqui.</p>
          )}
          {lines.map((l, i) => (
            <article key={i} className="flex flex-col gap-1.5 rounded-2xl bg-card p-4">
              {l.cue && <p className="text-sm leading-relaxed text-muted-foreground">{l.cue}</p>}
              <p className="text-xl font-semibold leading-snug">{l.text}</p>
            </article>
          ))}
        </section>
      )}

      <Acompanhar shots={part.shots} lines={lines} scenes={isCrew ? scenes : {}} appears={appears} films={films} loadedAt={new Date().toISOString()} />

      {isCrew && (
        <section aria-labelledby="roteiro" className="flex flex-col gap-3">
          <h2 id="roteiro" className="label-set">
            Roteiro
          </h2>
          {part.blocks.map((b) => (
            <article key={b.number} className="flex flex-col gap-1.5 rounded-2xl bg-card p-4">
              <span className="label-set text-muted-foreground">
                Parte {String(b.number).padStart(2, "0")} · {b.label || BLOCK_KINDS[b.kind].label}
              </span>
              {b.speech && <p className="whitespace-pre-line leading-relaxed">{b.speech}</p>}
              {b.on_screen && <p className="text-sm text-muted-foreground">Na tela: {b.on_screen}</p>}
              {b.action && <p className="text-sm text-muted-foreground">O que acontece: {b.action}</p>}
            </article>
          ))}
        </section>
      )}

      <footer className="flex flex-col gap-2 pt-4 text-center text-xs leading-relaxed text-muted-foreground">
        <p>
          Seus dados aqui: só o seu nome, a confirmação e, se você autorizar, o registro da autorização de imagem. Usamos para
          organizar a gravação e mais nada.{" "}
          <Link href="/privacidade" className="font-semibold underline">
            Política de Privacidade
          </Link>
        </p>
        <p>Feito com o Gravaí · este link é só seu, não compartilhe</p>
      </footer>
    </div>
  );
}
