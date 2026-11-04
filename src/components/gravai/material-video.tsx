import Link from "next/link";
import { PlanList, type PlanRow } from "@/components/gravai/lista-planos";
import { speechLines, splitAction } from "@/lib/convidado";
import { ROLES, formatShootDate, sortRoles, type GuestRole, type PersonRole } from "@/lib/pessoas";
import type { Resource } from "@/lib/ideas";
import type { Shot } from "@/lib/planos";
import { BLOCK_KINDS, type ScriptBlock } from "@/lib/roteiro";
import { byPlace, setOrder } from "@/lib/set";

export type SheetBlock = ScriptBlock & { id: string; position: number; updated_at?: string };
export type SheetShot = Shot & { id: string; created_at?: string; shoot_order: number | null; recorded: boolean; good_take: boolean; takes: number };
export type SheetPerson = { id: string; name: string; role: PersonRole; roles: GuestRole[]; confirmed_at: string | null };

// Cada parte da folha, com o atalho para mudar o que está nela.
function Part({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <h2 className="label-set text-muted-foreground">{title}</h2>
        <Link href={href} className="flex min-h-11 items-center text-sm font-semibold underline">
          Mudar
        </Link>
      </div>
      {children}
    </section>
  );
}

// A folha do vídeo: tudo o que a pessoa precisa no dia de gravar, na ordem em que ela consulta. Dá para gravar só com isto.
export function VideoMaterial({ video, blocks, shots, people }: { video: { id: string; resources?: Resource[]; shoot_date?: string | null; shoot_place?: string | null }; blocks: SheetBlock[]; shots: SheetShot[]; people: SheetPerson[] }) {
  const base = `/video/${video.id}`;
  const ordered = setOrder(shots);
  const script = new Map([...shots].sort((a, b) => blocks.findIndex((x) => x.id === a.block_id) - blocks.findIndex((x) => x.id === b.block_id) || a.position - b.position).map((s, i) => [s.id, i + 1]));
  const rows: PlanRow[] = ordered.map((s, i) => ({
    id: s.id,
    number: script.get(s.id) ?? i + 1,
    description: s.description,
    framing: s.framing,
    angle: s.angle,
    movement: s.movement,
    orientation: s.orientation,
    location: s.location,
    recorded: s.recorded,
    good: s.good_take,
    takes: s.takes,
    skipped: false,
    current: false,
  }));
  const guests = people.filter((p) => p.role !== "eu");
  const resources = video.resources ?? [];
  const alone = resources.includes("com_alguem") ? "Mais de uma pessoa, ainda sem nomes." : resources.includes("sozinho") ? "Só você." : "Ainda não definido.";
  const places = byPlace(ordered).filter((g) => g.place);
  const when = [formatShootDate(video.shoot_date ?? null), video.shoot_place].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <Part title="Roteiro" href={`${base}/roteiro`}>
        <div className="flex flex-col divide-y divide-border rounded-2xl bg-card px-4">
          {blocks.map((b, i) => {
            const action = splitAction(b.action).text;
            return (
              <article key={b.id} className="flex flex-col gap-1.5 py-3.5">
                <h3 className="label-set text-muted-foreground">
                  {String(i + 1).padStart(2, "0")} · {b.label || BLOCK_KINDS[b.kind].label}
                </h3>
                {action && <p className="text-sm italic leading-snug text-muted-foreground">{action}</p>}
                {speechLines(b.speech).map((l, n) => (
                  <p key={n} className="text-[17px] font-semibold leading-snug">
                    {l.raw}
                  </p>
                ))}
                {b.on_screen && (
                  <p className="text-sm text-muted-foreground">
                    <span className="label-set mr-2">Tela</span>
                    {b.on_screen}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </Part>

      {rows.length > 0 && (
        <Part title="Planos · na ordem de gravar" href={`${base}/planos`}>
          <div className="rounded-2xl bg-card p-2">
            <PlanList rows={rows} wrap />
          </div>
        </Part>
      )}

      <Part title="Pessoas" href={`${base}/pessoas`}>
        <div className="flex flex-col divide-y divide-border rounded-2xl bg-card px-4">
          {guests.length === 0 && <p className="py-3.5 text-[15px]">{alone}</p>}
          {guests.map((p) => (
            <div key={p.id} className="flex items-baseline justify-between gap-3 py-3.5">
              <span className="min-w-0 break-words text-[15px] font-semibold">{p.name}</span>
              <span className="label-set shrink-0 text-right text-muted-foreground">{sortRoles(p.roles).map((r) => ROLES[r].label).join(" · ")}</span>
            </div>
          ))}
        </div>
      </Part>

      {(places.length > 0 || when) && (
        <Part title="Onde gravar" href={`${base}/pessoas`}>
          <div className="flex flex-col divide-y divide-border rounded-2xl bg-card px-4">
            {when && <p className="py-3.5 text-[15px] font-semibold first-letter:uppercase">{when}</p>}
            {places.map((g) => (
              <div key={g.place} className="flex items-baseline justify-between gap-3 py-3.5">
                <span className="min-w-0 break-words text-[15px] font-semibold">{g.place}</span>
                <span className="label-set shrink-0 text-muted-foreground">
                  {g.rows.length} {g.rows.length === 1 ? "plano" : "planos"}
                </span>
              </div>
            ))}
          </div>
        </Part>
      )}
    </div>
  );
}
