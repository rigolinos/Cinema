"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Barra fixa da página inicial, no celular: o botão fica perto do polegar depois que o topo sai da tela.
// Some no topo e no final, onde o mesmo botão já está à vista.
export function BarraComecar({ hideOn }: { hideOn: string[] }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      setShow(visible.size === 0);
    });
    for (const id of hideOn) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [hideOn]);

  if (!show) return null;
  return (
    <div className="animate-slide-up fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] sm:hidden">
      <div className="px-4 py-3">
        <Link href="/register" className="flex min-h-13 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
          Começar de graça
        </Link>
      </div>
    </div>
  );
}
