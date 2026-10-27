import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { IdeiasGuardadas } from "@/components/gravai/ideias-guardadas";

// Ideias guardadas com o marcador: ficam aqui, fora do caminho da quinzena, para gravar quando quiser.
export default function GuardadasPage() {
  return (
    <div className="flex flex-col gap-5">
      <Link href="/ideias" aria-label="Voltar às ideias" className="-ml-3 -mt-3 flex size-11 items-center justify-center">
        <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </Link>
      <header className="flex flex-col gap-1.5">
        <p className="label-set text-muted-foreground">Ideias</p>
        <h1 className="font-display text-[30px]">Guardadas</h1>
      </header>
      <IdeiasGuardadas />
    </div>
  );
}
