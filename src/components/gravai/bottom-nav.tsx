"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, House, Lightbulb, Plus, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/inicio", label: "Início", icon: House },
  { href: "/ideias", label: "Ideias", icon: Lightbulb },
  { href: "/novo", label: "Novo vídeo", icon: Plus, main: true },
  { href: "/aprenda", label: "Aprenda", icon: BookOpen },
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
          if (main) {
            return (
              <Link key={href} href={href} aria-label={label} className="flex min-h-13 items-center justify-center">
                <span className="flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="size-6" strokeWidth={2} aria-hidden="true" />
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
