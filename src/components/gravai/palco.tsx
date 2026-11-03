"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { timecode } from "@/lib/set";
import { cn } from "@/lib/utils";

// O palco da entrada do app: a marca gigante com o pingo vivo e a câmera "ligada".
// Com a pessoa digitando (compact), a marca encolhe e o tempo para: nada se mexe enquanto ela escreve.
function Timecode({ paused }: { paused: boolean }) {
  const el = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      frame.current += 1;
      if (el.current) el.current.textContent = timecode(frame.current);
    }, 1000 / 24);
    return () => clearInterval(timer);
  }, [paused]);
  return <span ref={el}>{timecode(0)}</span>;
}

export function Palco({
  compact = false,
  action,
  headline,
  linkHome = true,
  className,
  children,
}: {
  compact?: boolean;
  action?: React.ReactNode; // no canto de cima, à direita; o tempo de câmera vai para a esquerda
  headline?: React.ReactNode; // no lugar da frase da marca
  linkHome?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const logo = <LogoMark className="palco-logo" dotClassName="palco-pingo" />;
  return (
    <div className={cn("palco dark relative overflow-hidden text-foreground", compact && "palco-compacto", className)}>
      <div className="absolute inset-x-0 top-[max(1.25rem,env(safe-area-inset-top))]">
        <div className={cn("palco-coluna flex items-center", action ? "justify-between" : "justify-end")}>
          <p className="label-set flex items-center gap-2 text-muted-foreground" aria-hidden="true">
            <span className="palco-rec size-2 rounded-full bg-rec" />
            <Timecode paused={compact} />
          </p>
          {action}
        </div>
      </div>
      <div className="palco-marca palco-coluna">
        {linkHome ? (
          <Link href="/" aria-label="Início" className="block">
            {logo}
          </Link>
        ) : (
          logo
        )}
        {headline ?? <p className="palco-frase mt-2 text-muted-foreground">Da ideia ao vídeo gravado.</p>}
        {children}
      </div>
    </div>
  );
}

// Ao entrar: o pingo cresce até encher a tela e some, revelando o app. Menos de 1 segundo.
// Vive fora da página, para continuar enquanto a próxima tela carrega.
export function fillWithRec() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const dot = document.querySelector(".palco-pingo")?.getBoundingClientRect();
  if (!dot || !dot.width) return;
  const far = Math.hypot(Math.max(dot.left, window.innerWidth - dot.left), Math.max(dot.top, window.innerHeight - dot.top));
  const scale = (2 * far) / dot.width + 1;
  const wipe = document.createElement("div");
  wipe.setAttribute("aria-hidden", "true");
  Object.assign(wipe.style, {
    position: "fixed",
    left: `${dot.left}px`,
    top: `${dot.top}px`,
    width: `${dot.width}px`,
    height: `${dot.height}px`,
    borderRadius: "50%",
    background: "var(--rec)",
    zIndex: "70",
    pointerEvents: "none",
  });
  document.body.append(wipe);
  wipe.animate(
    [
      { transform: "scale(1)", opacity: 1, offset: 0 },
      { transform: `scale(${scale})`, opacity: 1, offset: 0.65 },
      { transform: `scale(${scale})`, opacity: 0, offset: 1 },
    ],
    { duration: 850, easing: "cubic-bezier(0.6, 0, 0.3, 1)", fill: "forwards" },
  ).onfinish = () => wipe.remove();
}
