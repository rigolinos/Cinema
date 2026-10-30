import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { cueParts, isMe, myLines, speechLines, splitAction } from "@/lib/convidado";
import { BLOCK_KINDS } from "@/lib/roteiro";
import { formatShootDate, rolesYou } from "@/lib/pessoas";
import { Abas } from "./abas";
import { Acompanhar } from "./acompanhar";
import { PartActions } from "./actions";
import { firstNameOf, getPart, partRoles, signupUrl } from "./dados";

// Link pessoal: ninguém deve achar por busca. A prévia (WhatsApp) chama a pessoa pelo nome.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const part = await getPart((await params).token);
  const base = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };
  if (!part) return { ...base, title: "Convite para gravar · Gravaí" };
  const title = `${firstNameOf(part.person.name)}, você está no time de “${part.video.title}”`;
  const description = "Suas falas, o dia e o lugar da gravação. Feito no Gravaí.";
  return { ...base, title, description, openGraph: { title, description, siteName: "Gravaí", locale: "pt_BR", type: "website" } };
}

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
  const part = await getPart(token);
  if (!part) return <NotFound />;

  const roles = partRoles(part);
  const appears = roles.includes("ator");
  const films = roles.includes("filma");
  const isCrew = roles.some((r) => r !== "ator");
  const date = formatShootDate(part.video.shoot_date);
  const firstName = firstNameOf(part.person.name);
  const lines = appears ? myLines(part.blocks.map((b) => ({ ...b, cue: b.cue ?? null })), part.person.name) : [];
  const scenes = Object.fromEntries(part.blocks.map((b) => [b.number, speechLines(b.speech).map((l) => l.raw)]));

  const when = [date, part.video.shoot_place].filter(Boolean).join(" · ") || null;
  const signup = signupUrl(firstName);

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

  const gravacao = <Acompanhar shots={part.shots} lines={lines} scenes={isCrew ? scenes : {}} appears={appears} films={films} loadedAt={new Date().toISOString()} signup={signup} />;

  // No dia, com algo já gravado, o link abre na Gravação; antes, nas falas (ou no roteiro, para quem não atua).
  const tabs = [
    appears && { id: "falas", label: `Falas · ${lines.length}`, content: falas },
    isCrew && { id: "roteiro", label: "Roteiro", content: roteiro },
    { id: "gravacao", label: "Gravação", content: gravacao },
  ].filter((t): t is { id: string; label: string; content: React.ReactElement } => Boolean(t));
  const initial = part.shots.some((s) => s.recorded) ? "gravacao" : appears ? "falas" : "roteiro";

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-5 pb-12 pt-6">
      {/* A porta do app para quem foi chamado: a marca se apresenta numa linha e o nome da pessoa vem grande. */}
      <div className="flex flex-col gap-1.5 border-b border-border pb-4">
        <Logo className="text-[34px]" />
        <p className="text-sm text-muted-foreground">Da ideia ao vídeo gravado.</p>
      </div>

      <header className="flex flex-col gap-2">
        <p className="label-set text-muted-foreground">{part.creator ? `Convite de ${part.creator}` : "Convite para gravar"}</p>
        <h1 className="font-display text-[52px] leading-[0.95]">
          Oi,
          <br />
          {firstName}.
        </h1>
        <p className="text-lg leading-snug">
          Você está no time de <strong className="font-semibold">“{part.video.title}”</strong>: {rolesYou(roles)}.
        </p>
      </header>

      <PartActions token={token} creator={part.creator} title={part.video.title} confirmed={part.person.confirmed} consented={part.consented} needsConsent={appears} when={when} signup={signup} />

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
