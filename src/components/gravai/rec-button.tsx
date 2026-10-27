import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Ação dos cartões de ideia: o mesmo REC do menu, em miniatura. Repetido em vários cartões não grita como uma barra preta.
export function RecButton({ onClick, label = "Gravar", ariaLabel }: { onClick: () => void; label?: string; ariaLabel: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className="group flex min-h-11 shrink-0 items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-foreground">
      <span className="label-set text-foreground" aria-hidden="true">
        {label}
      </span>
      <span className="flex size-11 items-center justify-center rounded-full border-2 border-foreground" aria-hidden="true">
        <span className="size-4 rounded-full bg-rec transition-transform duration-150 group-active:scale-75" />
      </span>
    </button>
  );
}

// Quando a ideia já virou vídeo: no mesmo lugar do REC, um link para ele.
export function OpenVideoLink({ href }: { href: string }) {
  return (
    <Link href={href} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-foreground">
      <span className="label-set text-foreground">Abrir o vídeo</span>
      <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}
