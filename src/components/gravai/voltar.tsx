"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// As telas abertas nesta sessão, na ordem. Voltar para a anterior tira a atual da lista.
let trail: string[] = [];
function note(path: string) {
  if (trail.at(-1) === path) return;
  if (trail.at(-2) === path) trail = trail.slice(0, -1);
  else trail = [...trail, path];
}

export function RouteTracker() {
  const pathname = usePathname();
  useEffect(() => note(pathname), [pathname]);
  return null;
}

// A seta faz o mesmo que o voltar do celular: uma tela para trás. Quem chegou direto por um link vai para `href`.
export function BackLink({ href, label = "Voltar", className, children }: { href: string; label?: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-label={label}
      className={className}
      onClick={(e) => {
        if (trail.length < 2) return;
        e.preventDefault();
        router.back();
      }}
    >
      {children}
    </Link>
  );
}

// Sair de uma etapa ou terminar: vai para `href` sem deixar a etapa no caminho.
// Senão, a seta da tela seguinte devolveria a pessoa para o que ela acabou de fechar.
export function useLeave() {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      if (trail.at(-2) === href) {
        router.back();
        return;
      }
      trail = trail.slice(0, -1);
      router.replace(href);
    },
    [router],
  );
}

export function LeaveLink({ href, label, className, children }: { href: string; label: string; className?: string; children: React.ReactNode }) {
  const leave = useLeave();
  return (
    <Link
      href={href}
      aria-label={label}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        leave(href);
      }}
    >
      {children}
    </Link>
  );
}
