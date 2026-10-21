import { BottomNav } from "@/components/gravai/bottom-nav";

// Telas principais do criador: conteúdo numa coluna de celular e o menu embaixo.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto w-full max-w-lg px-5 pb-32 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
