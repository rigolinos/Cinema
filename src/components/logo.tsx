import { cn } from "@/lib/utils";

// Logotipo: "gravaí" com o pingo do í no vermelho da luz de gravação.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("font-display inline-block leading-none", className)} aria-label="Gravaí" role="img">
      <span aria-hidden="true">
        grava
        <span className="relative inline-block">
          ı
          <span className="absolute left-1/2 top-[0.04em] size-[0.2em] -translate-x-1/2 rounded-full bg-rec" />
        </span>
      </span>
    </span>
  );
}
