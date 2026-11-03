"use client";

import { useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Palco } from "@/components/gravai/palco";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A tela de entrada e a de cadastro: o palco em cima e a folha clara embaixo, perto do polegar.
// Com a pessoa digitando, o palco encolhe para o formulário ficar acima do teclado.
export function Entrada({ title, children }: { title: string; children: React.ReactNode }) {
  const [compact, setCompact] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const pressing = useRef(false);

  // Só volta ao palco grande depois do toque terminar: se o layout mudasse no meio do toque,
  // o botão sairia de baixo do dedo.
  function settle() {
    setTimeout(() => {
      if (pressing.current) return;
      if (!(document.activeElement instanceof HTMLInputElement && sheet.current?.contains(document.activeElement))) setCompact(false);
    }, 150);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#0E0E0E]">
      <h1 className="sr-only">{title}</h1>
      <Palco compact={compact} />

      <div
        ref={sheet}
        onFocusCapture={(e) => {
          if (e.target instanceof HTMLInputElement && e.target.type !== "checkbox") setCompact(true);
        }}
        onBlurCapture={settle}
        onPointerDownCapture={() => {
          pressing.current = true;
        }}
        onPointerUpCapture={() => {
          pressing.current = false;
          settle();
        }}
        onPointerCancelCapture={() => {
          pressing.current = false;
        }}
        className={cn("folha-sobe relative rounded-t-[1.625rem] bg-background pb-[env(safe-area-inset-bottom)]", compact && "flex-1")}
      >
        <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-5 pb-5 pt-6">{children}</div>
      </div>
    </div>
  );
}

// Senha com o olho para conferir o que foi digitado: no celular, errar uma letra é fácil.
export function CampoSenha(props: Omit<React.ComponentProps<typeof Input>, "type" | "className">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="h-12 bg-card pr-12 text-base" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Esconder a senha" : "Mostrar a senha"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground"
      >
        {visible ? <EyeOff className="size-5" strokeWidth={1.75} aria-hidden="true" /> : <Eye className="size-5" strokeWidth={1.75} aria-hidden="true" />}
      </button>
    </div>
  );
}
