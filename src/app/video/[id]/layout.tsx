import { LegalGate } from "@/components/gravai/legal-gate";

// Dentro de um vídeo a pessoa está focada no passo: sem o menu de baixo.
export default function VideoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <LegalGate />
      {children}
    </div>
  );
}
