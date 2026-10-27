import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Ação dos cartões de ideia: texto na letra de claquete com seta. Repetido em vários cartões não grita como uma barra preta.
const ACTION = "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-foreground";

export function UseIdeaButton({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={ACTION}>
      <span className="label-set text-foreground">Usar ideia</span>
      <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

// Quando a ideia já virou vídeo: no mesmo lugar, um link para ele.
export function OpenVideoLink({ href }: { href: string }) {
  return (
    <Link href={href} className={ACTION}>
      <span className="label-set text-foreground">Abrir o vídeo</span>
      <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}
