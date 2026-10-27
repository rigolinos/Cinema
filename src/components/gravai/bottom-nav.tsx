"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, House, Lightbulb, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/inicio", label: "Início", icon: House },
  { href: "/ideias", label: "Ideias", icon: Lightbulb },
  { href: "/novo", label: "Novo vídeo", icon: null, main: true },
  { href: "/videos", label: "Vídeos", icon: Film },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Menu principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-center px-2 py-1.5">
        {items.map(({ href, label, icon: Icon, main }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          if (main || !Icon) {
            // Novo vídeo = o botão de gravar da câmera: anel branco com o ponto vermelho do Gravaí,
            // que "aperta" ao tocar. O vermelho fica só na marca e na gravação, e este botão é as duas coisas.
            return (
              <Link key={href} href={href} aria-label={label} className="group flex min-h-13 items-center justify-center">
                <span className="flex size-13 items-center justify-center rounded-full bg-primary">
                  <span className="flex size-[30px] items-center justify-center rounded-full border-2 border-primary-foreground">
                    <span className="size-4 rounded-full bg-rec transition-transform duration-150 group-active:scale-75" aria-hidden="true" />
                  </span>
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-13 flex-col items-center justify-center gap-1 text-xs",
                active ? "font-bold text-foreground" : "font-medium text-muted-foreground",
              )}
            >
              <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
