import { cn } from "@/lib/utils";

// Logotipo: "gravaí" com o pingo do í no vermelho da luz de gravação.
// O espaço negativo entre as letras encurta a caixa do ı; o pingo compensa metade para ficar no centro.
export function Logo({ className, dotClassName }: { className?: string; dotClassName?: string }) {
  return (
    <span className={cn("font-display inline-block leading-none", className)} aria-label="Gravaí" role="img">
      <span aria-hidden="true">
        grava
        <span className="relative inline-block">
          ı
          <span className={cn("absolute left-[calc(50%+0.0125em)] top-[0.04em] size-[0.2em] -translate-x-1/2 rounded-full bg-rec", dotClassName)} />
        </span>
      </span>
    </span>
  );
}
