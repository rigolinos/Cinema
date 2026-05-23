import Link from "next/link";
import { Film, Calendar, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px]" />

        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center animate-fade-in">
          {/* Logo */}
          <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-primary/20 bg-primary/5 px-5 py-2">
            <Film className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">CineBoard</span>
          </div>

          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Sua produção,{" "}
            <span className="text-primary">organizada.</span>
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
            Planeje a ordem do dia com inteligência artificial. Otimize dias de
            gravação, elenco e locações automaticamente.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="rounded-full px-8 font-semibold">
                Começar agora
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-8 font-semibold"
              >
                Entrar
              </Button>
            </Link>
          </div>

          {/* Feature cards */}
          <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                icon: Calendar,
                title: "Ordem do Dia",
                desc: "Gerada por IA com otimização de custos",
              },
              {
                icon: Users,
                title: "Casting Inteligente",
                desc: "Vincule atores e gerencie disponibilidade",
              },
              {
                icon: BarChart3,
                title: "Métricas de Produção",
                desc: "Actor-days, custos e conflitos em tempo real",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-border/50 bg-card/50 p-6 text-left backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80"
              >
                <f.icon className="h-8 w-8 text-primary mb-3 transition-transform group-hover:scale-110" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        © 2026 CineBoard. Todos os direitos reservados.
      </footer>
    </div>
  );
}
