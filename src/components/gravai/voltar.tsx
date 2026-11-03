"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Quantas telas a pessoa já abriu nesta sessão, para saber se há para onde voltar dentro do app.
let visited = 0;
function countVisit() {
  visited += 1;
}

export function RouteTracker() {
  const pathname = usePathname();
  useEffect(countVisit, [pathname]);
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
        if (visited < 2) return;
        e.preventDefault();
        router.back();
      }}
    >
      {children}
    </Link>
  );
}
