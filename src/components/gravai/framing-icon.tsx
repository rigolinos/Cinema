import type { Framing, Orientation } from "@/lib/planos";
import { cn } from "@/lib/utils";

// Silhuetas desenhadas numa tela 9:16 (40 × 64): quanto mais perto, maior a pessoa.
const FIGURES: Record<Framing, React.ReactNode> = {
  // Detalhe: uma mão enchendo a tela.
  detalhe: (
    <>
      <rect x="7" y="16" width="5.5" height="30" rx="2.75" />
      <rect x="13.5" y="10" width="5.5" height="34" rx="2.75" />
      <rect x="20" y="12" width="5.5" height="32" rx="2.75" />
      <rect x="26.5" y="18" width="5.5" height="28" rx="2.75" />
      <path d="M7 38h25v26H7Z" />
      <path d="M32 44l6-9c1.6-2.3 4.6-.6 3.4 1.9L36 52Z" />
    </>
  ),
  close: (
    <>
      <circle cx="20" cy="29" r="12" />
      <path d="M1 64C3 48 37 48 39 64Z" />
    </>
  ),
  medio: (
    <>
      <circle cx="20" cy="22" r="7.5" />
      <path d="M7 64V42c0-10 26-10 26 0v22Z" />
    </>
  ),
  americano: (
    <>
      <circle cx="20" cy="17" r="5.5" />
      <path d="M11 64V34c0-8 18-8 18 0v30Z" />
    </>
  ),
  aberto: (
    <>
      <circle cx="20" cy="17" r="4" />
      <path d="M15 24h10v20h-2v14h-6V44h-2Z" />
    </>
  ),
};

// O enquadramento em desenho: a forma do plano diz mais do que o nome para quem está começando.
// Deitado (horizontal), a tela vira 16:9 e a pessoa fica menor no centro.
export function FramingIcon({ framing, orientation, large }: { framing: Framing; orientation: Orientation; large?: boolean }) {
  const vertical = orientation === "vertical";
  return (
    <svg
      viewBox={vertical ? "0 0 40 64" : "0 0 64 40"}
      className={cn("shrink-0", vertical ? (large ? "h-24 w-15" : "h-16 w-10") : large ? "h-15 w-24" : "h-10 w-16")}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`tela-${framing}-${orientation}`}>
          <rect x="0" y="0" width={vertical ? 40 : 64} height={vertical ? 64 : 40} rx="6" />
        </clipPath>
      </defs>
      <g clipPath={`url(#tela-${framing}-${orientation})`}>
        <rect x="0" y="0" width={vertical ? 40 : 64} height={vertical ? 64 : 40} className="fill-muted" />
        <g className="fill-muted-foreground/35" transform={vertical ? undefined : "translate(19.5 0) scale(0.625)"}>
          {FIGURES[framing]}
        </g>
      </g>
      <rect x="0.5" y="0.5" width={vertical ? 39 : 63} height={vertical ? 63 : 39} rx="5.5" fill="none" className="stroke-border" />
    </svg>
  );
}
