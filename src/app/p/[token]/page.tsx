import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { cueParts, isMe, myLines, speechLines, splitAction } from "@/lib/convidado";
import { BLOCK_KINDS, type BlockKind } from "@/lib/roteiro";
import { formatShootDate, rolesYou, type GuestRole, type PersonRole } from "@/lib/pessoas";
import { Abas } from "./abas";
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

  const when = [date, part.video.shoot_place].filter(Boolean).join(" · ") || null;

  const falas = (
    <div className="flex flex-col gap-3">
      {lines.length === 0 && <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Ainda não tem fala sua no roteiro. Quando tiver, aparece aqui.</p>}
      {lines.map((l, i) => {
        const cue = l.cue ? cueParts(l.cue) : null;
        return (
          <article key={i} className="flex flex-col gap-1.5 rounded-2xl bg-card p-4">
            <p className="label-set text-muted-foreground">
              Parte {String(l.block).padStart(2, "0")} · {cue ? `deixa${cue.speaker ? ` de ${cue.speaker}` : ""}` : "você começa"}
            </p>
            {cue?.tail && <p className="text-sm text-muted-foreground">{cue.tail}</p>}
            <p className="text-xl font-semibold leading-snug">{l.text}</p>
          </article>
        );
      })}
    </div>
  );

  // Formato de roteiro: quem fala numa coluna, a ação em itálico (rubrica), a câmera numa linha própria.
  const roteiro = (
    <div className="flex flex-col gap-3">
      {part.blocks.map((b) => {
        const action = splitAction(b.action);
        return (
          <article key={b.number} className="flex flex-col gap-2 rounded-2xl bg-card p-4">
            <h3 className="label-set text-muted-foreground">
              {String(b.number).padStart(2, "0")} · {b.label || BLOCK_KINDS[b.kind].label}
            </h3>
            {b.on_screen && (
              <p className="text-sm">
                <span className="label-set mr-2 text-muted-foreground">Tela</span>
                {b.on_screen}
              </p>
            )}
            {action.text && <p className="text-sm italic leading-relaxed text-muted-foreground">{action.text}</p>}
            {action.camera.map((c) => (
              <p key={c} className="label-set text-muted-foreground">
                Câmera · {c}
              </p>
            ))}
            {speechLines(b.speech).map((l, i) => {
              const mine = appears && l.speaker !== null && isMe(l.speaker, part.person.name);
              return l.speaker ? (
                <p key={i} className={cn("grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 rounded-lg px-2 py-1 leading-relaxed", mine && "bg-muted font-semibold")}>
                  <span className={cn("label-set pt-1", mine ? "text-foreground" : "text-muted-foreground")}>{mine ? "Você" : l.speaker}</span>
                  <span>{l.text}</span>
                </p>
              ) : (
                <p key={i} className="leading-relaxed">
                  {l.text}
                </p>
              );
            })}
          </article>
        );
      })}
    </div>
  );

  const gravacao = <Acompanhar shots={part.shots} lines={lines} scenes={isCrew ? scenes : {}} appears={appears} films={films} loadedAt={new Date().toISOString()} />;

  // No dia, com algo já gravado, o link abre na Gravação; antes, nas falas (ou no roteiro, para quem não atua).
  const tabs = [
    appears && { id: "falas", label: "Falas", count: lines.length, content: falas },
    isCrew && { id: "roteiro", label: "Roteiro", content: roteiro },
    { id: "gravacao", label: "Gravação", content: gravacao },
  ].filter((t): t is { id: string; label: string; count?: number; content: React.ReactElement } => Boolean(t));
  const initial = part.shots.some((s) => s.recorded) ? "gravacao" : appears ? "falas" : "roteiro";

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-5 pb-12 pt-6">
      <Logo className="text-2xl" />

      <header className="flex flex-col gap-1.5">
        <p className="label-set text-muted-foreground">{part.creator ? `Convite de ${part.creator}` : "Convite para gravar"}</p>
        <h1 className="font-display text-[30px]">Oi, {firstName}.</h1>
        <p className="leading-relaxed">
          “{part.video.title}” · {rolesYou(roles)}
        </p>
      </header>

      <PartActions token={token} creator={part.creator} title={part.video.title} confirmed={part.person.confirmed} consented={part.consented} needsConsent={appears} when={when} />

      <Abas tabs={tabs} initial={initial} />

      <footer className="pt-4 text-center text-xs leading-relaxed text-muted-foreground">
        Este link é só seu. Seu nome, a confirmação e a autorização servem só para organizar a gravação.{" "}
        <Link href="/privacidade" className="font-semibold underline">
          Privacidade
        </Link>
      </footer>
    </div>
  );
}
