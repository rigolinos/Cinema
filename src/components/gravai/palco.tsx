"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { timecode } from "@/lib/set";
import { cn } from "@/lib/utils";

// O palco da entrada do app: a marca gigante com o pingo vivo, a câmera "ligada" e, bem no fundo,
// os formatos e termos de set passando. Decoração: quem lê a tela com leitor ouve só a marca.
// Com a pessoa digitando (compact), a marca encolhe e o fundo para: nada se mexe enquanto ela escreve.
const ROWS = [
  "POV · 3 erros que… · Antes e depois · Storytime",
  "Bastidores · Tutorial rápido · Reação · Desafio",
  "Mito ou verdade · Diálogo · O gancho · A virada",
  "Plano 01 · Take 2 · Close · Aberto · Detalhe",
];

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

export function Palco({ compact }: { compact: boolean }) {
  return (
    <div className={cn("palco dark relative overflow-hidden text-foreground", compact && "palco-compacto")}>
      <div className="palco-fundo" aria-hidden="true">
        {ROWS.map((row) => (
          <p key={row} className="palco-fila">
            {Array(12).fill(`${row} · `).join("")}
          </p>
        ))}
      </div>
      <p className="label-set absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] flex items-center gap-2 text-muted-foreground" aria-hidden="true">
        <span className="palco-rec size-2 rounded-full bg-rec" />
        <Timecode paused={compact} />
      </p>
      <div className="palco-marca mx-auto w-full max-w-lg px-5">
        <Link href="/" aria-label="Início" className="block">
          <Logo className="palco-logo" dotClassName="palco-pingo" />
        </Link>
        <p className="palco-frase mt-2 text-muted-foreground">Da ideia ao vídeo gravado.</p>
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
