import { Check } from "lucide-react";
import { FramingIcon } from "@/components/gravai/framing-icon";
import { FRAMINGS, shotTags, type Angle, type Framing, type Movement, type Orientation } from "@/lib/planos";
import { byPlace } from "@/lib/set";
import { cn } from "@/lib/utils";

// Os planos na ordem de gravação, agrupados por lugar, com o estado de cada um.
// No set, tocar num plano leva até ele; no link do convidado, a mesma lista serve só para ver.
export interface PlanRow {
  id: string;
  number: number; // número no roteiro
  description: string;
  framing: Framing;
  angle: Angle;
  movement: Movement;
  orientation: Orientation;
  location: string;
  recorded: boolean;
  good: boolean;
  takes: number;
  skipped: boolean;
  current: boolean;
  tag?: string; // no convidado: "Você aparece", "Você filma"
}

function detail(r: PlanRow): string {
  if (r.recorded) return [r.good && "★ Bom", `${r.takes} ${r.takes === 1 ? "take" : "takes"}`].filter(Boolean).join(" · ");
  if (r.current) return "Agora";
  if (r.skipped) return "Pulado";
  return shotTags(r).join(" · ");
}

export function PlanList({ rows, onPick }: { rows: PlanRow[]; onPick?: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {byPlace(rows).map((group, g) => (
        <section key={`${group.place}-${g}`} aria-label={group.place || "Sem lugar"} className="flex flex-col gap-1">
          {group.place && <h3 className="label-set px-2 pt-1 text-muted-foreground">{group.place}</h3>}
          <ul className="flex flex-col gap-1">
            {group.rows.map((r) => {
              const body = (
                <>
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full",
                      r.recorded ? "bg-foreground text-background" : r.skipped ? "border-[1.5px] border-dashed border-muted-foreground" : "border-[1.5px] border-input",
                    )}
                    aria-hidden="true"
                  >
                    {r.recorded && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <FramingIcon framing={r.framing} orientation={r.orientation} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold">
                      <span className="mr-1.5 font-mono text-sm text-muted-foreground">{String(r.number).padStart(2, "0")}</span>
                      {r.description || FRAMINGS[r.framing].label}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("label-set", r.current ? "text-foreground" : "text-muted-foreground")}>{detail(r)}</span>
                      {r.tag && <span className="label-set rounded bg-muted px-1.5 text-foreground">{r.tag}</span>}
                    </span>
                  </span>
                </>
              );
              const row = cn("flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left", r.current && "bg-muted outline-[1.5px] outline-rec outline");
              const state = r.recorded ? "gravado" : r.current ? "agora" : r.skipped ? "pulado" : "falta gravar";
              return (
                <li key={r.id}>
                  {onPick ? (
                    <button type="button" onClick={() => onPick(r.id)} aria-current={r.current ? "step" : undefined} aria-label={`Plano ${r.number}: ${r.description || FRAMINGS[r.framing].label}, ${state}`} className={row}>
                      {body}
                    </button>
                  ) : (
                    <div className={row}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
