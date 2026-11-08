import { ChevronLeft } from "lucide-react";
import { BackLink } from "@/components/gravai/voltar";
import { RadarSection } from "@/components/gravai/radar";
import { IdeiasQuinzena } from "@/components/gravai/ideias-quinzena";

// Ideias da quinzena (feitas para o perfil) e o radar da semana. Não é mais uma aba: chega-se pelo Início ou pelo Novo vídeo.
export default function IdeiasPage() {
  return (
    <div className="flex flex-col gap-8">
      <BackLink href="/novo" className="-mb-6 -ml-3 -mt-3 flex size-11 items-center justify-center">
        <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </BackLink>
      <IdeiasQuinzena />

      <RadarSection />
    </div>
  );
}
