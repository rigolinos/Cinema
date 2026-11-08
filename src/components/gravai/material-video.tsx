import { Check } from "lucide-react";
import { FramingIcon } from "@/components/gravai/framing-icon";
import { isMe, speechLines, splitAction } from "@/lib/convidado";
import { firstNameOf, formatShootDate, type GuestRole, type PersonRole } from "@/lib/pessoas";
import type { Resource } from "@/lib/ideas";
import { castOf, shotPeople, shotPlainTags, type Shot } from "@/lib/planos";
import { speakerOf, type ScriptBlock } from "@/lib/roteiro";
import { cn } from "@/lib/utils";

export type SheetBlock = ScriptBlock & { id: string; position: number; updated_at?: string; person_id?: string | null };
export type SheetShot = Shot & { id: string; created_at?: string; shoot_order: number | null; recorded: boolean; good_take: boolean; takes: number };
export type SheetPerson = { id: string; name: string; role: PersonRole; roles: GuestRole[]; confirmed_at: string | null };

const names = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

// Quem diz esta linha e o que é dito. "Primeiro erro: pouca água" fica inteiro: o que vem antes dos dois-pontos só conta como nome se for de alguém do vídeo.
function dialogLine(line: { speaker: string | null; text: string; raw: string }, fallback: string | null, people: SheetPerson[]): { who: string | null; text: string } {
  if (!line.speaker) return { who: fallback, text: line.raw };
  return people.some((p) => isMe(line.speaker as string, p.name)) ? { who: firstNameOf(line.speaker), text: line.text } : { who: null, text: line.raw };
}

// Uma linha embaixo do título: quem está no vídeo, quem ajuda, o dia e o lugar.
export function sheetSummary(video: { resources?: Resource[]; shoot_date?: string | null; shoot_place?: string | null }, people: SheetPerson[]): string {
  const resources = video.resources ?? [];
  const guests = people.filter((p) => p.role !== "eu");
  const cast = castOf(people).map((c) => c.label);
  const crew = guests.flatMap((p) => {
    const jobs = [p.roles?.includes("filma") && "filma", p.roles?.includes("equipe") && "ajuda no set"].filter(Boolean) as string[];
    return jobs.length ? [`${firstNameOf(p.name)} ${names.format(jobs)}`] : [];
  });
  const alone = resources.includes("com_alguem") ? "Mais de uma pessoa, ainda sem nomes" : resources.includes("sozinho") ? "Só você" : "";
  const date = formatShootDate(video.shoot_date ?? null);
  return [
    guests.length ? names.format(cast) : alone,
    ...crew,
    date ? date.charAt(0).toLocaleUpperCase("pt-BR") + date.slice(1) : "",
    video.shoot_place,
  ]
    .filter(Boolean)
    .join(" · ");
}

// A folha do vídeo: uma lista só, cena por cena, com o que precisa ser filmado dentro de cada uma.
// Dá para gravar só com isto; o passo a passo do set segue a ordem de gravação.
export function VideoMaterial({ video, blocks, shots, people, creator, onToggleShot }: { video: { resources?: Resource[] }; blocks: SheetBlock[]; shots: SheetShot[]; people: SheetPerson[]; creator?: string | null; onToggleShot?: (id: string) => void }) {
  const resources = video.resources ?? [];
  const solo = resources.includes("sozinho") && !resources.includes("com_alguem");
  const number = new Map([...shots].sort((a, b) => blocks.findIndex((x) => x.id === a.block_id) - blocks.findIndex((x) => x.id === b.block_id) || a.position - b.position).map((s, i) => [s.id, i + 1]));

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) => {
        const action = splitAction(b.action).text;
        const speaker = speakerOf(b, people, solo, creator);
        const toFilm = shots.filter((s) => s.block_id === b.id).sort((x, y) => x.position - y.position);
        return (
          <article key={b.id} aria-label={`Cena ${i + 1}`} className="flex flex-col gap-1.5 rounded-2xl bg-card p-4">
            <h2 className="label-set text-muted-foreground">Cena {i + 1}</h2>
            {action && <p className="text-sm italic leading-snug text-muted-foreground">{action}</p>}
            {/* Como num roteiro de audiovisual: o nome em cima da fala, só quando muda quem fala. */}
            {speechLines(b.speech).map((l, n, all) => {
              const line = dialogLine(l, speaker, people);
              const before = n > 0 ? dialogLine(all[n - 1], speaker, people).who : null;
              return (
                <div key={n} className="flex flex-col gap-0.5">
                  {line.who && line.who !== before && <p className="label-set text-foreground">{line.who}</p>}
                  <p className="text-[17px] font-semibold leading-snug">{line.text}</p>
                </div>
              );
            })}
            {b.on_screen && (
              <p className="text-sm text-muted-foreground">
                <span className="label-set mr-2">Escrito na tela</span>
                {b.on_screen}
              </p>
            )}

            {toFilm.length > 0 && (
              <section aria-label={`Para filmar na cena ${i + 1}`} className="mt-2 flex flex-col gap-1.5 border-t border-border pt-3">
                <h3 className="label-set text-muted-foreground">Para filmar</h3>
                <ul className="flex flex-col">
                  {toFilm.map((s) => (
                    <li key={s.id} className="flex min-h-14 items-center gap-3 py-1.5">
                      <button
                        type="button"
                        aria-pressed={s.recorded}
                        aria-label={`Plano ${number.get(s.id)} já gravado`}
                        onClick={() => onToggleShot?.(s.id)}
                        className="-m-2.5 flex size-11 shrink-0 items-center justify-center rounded-full"
                      >
                        <span className={cn("flex size-6 items-center justify-center rounded-full", s.recorded ? "bg-foreground text-background" : "border-[1.5px] border-input")}>
                          {s.recorded && <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                      </button>
                      <FramingIcon framing={s.framing} orientation={s.orientation} size="sm" />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[15px] leading-snug">{s.description || shotPlainTags(s)[0]}</span>
                        <span className="label-set text-muted-foreground">{[...shotPlainTags(s), s.location.trim(), ...shotPeople(s, people)].filter(Boolean).join(" · ")}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        );
      })}
    </div>
  );
}
