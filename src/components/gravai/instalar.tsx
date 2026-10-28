"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy, EllipsisVertical, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { installMode, type InstallMode } from "@/lib/instalar";
import { isTwaReferrer } from "@/lib/android";

// O Chrome avisa que dá para instalar uma única vez, logo que a página carrega.
// O aviso fica guardado aqui até a pessoa tocar em "Instalar o app no celular" no Perfil.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Fica no layout raiz para pegar o aviso em qualquer página.
export function InstallCapture() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      // A faixa do próprio navegador continua; o item do Perfil usa o mesmo aviso depois.
      deferred = e as InstallPromptEvent;
      notify();
    };
    const onInstalled = () => {
      installed = true;
      deferred = null;
      notify();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

// Dentro do app da Google Play o Gravaí já está instalado. O Android só avisa na primeira página
// (pelo endereço de origem); o aviso fica guardado para as próximas.
function insideAndroidApp(): boolean {
  try {
    if (isTwaReferrer(document.referrer)) sessionStorage.setItem("gravai-android", "1");
    return sessionStorage.getItem("gravai-android") === "1";
  } catch {
    return isTwaReferrer(document.referrer);
  }
}

function currentMode(): InstallMode {
  const standalone =
    installed ||
    insideAndroidApp() ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return installMode({ ua: navigator.userAgent, standalone, canPrompt: deferred !== null, touchPoints: navigator.maxTouchPoints });
}

function useInstallMode(): InstallMode | null {
  // No servidor ainda não se sabe o aparelho: nada aparece até carregar.
  return useSyncExternalStore(subscribe, currentMode, () => null);
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] leading-relaxed">
      <span className="label-set mt-0.5 text-muted-foreground">{n}</span>
      <span>{children}</span>
    </li>
  );
}

const icon = "inline size-4 align-[-2px]";

function Sheet({ mode, onClose }: { mode: Exclude<InstallMode, "instalado" | "direto">; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="instalar-titulo"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-lg flex-col gap-5 rounded-t-3xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="label-set flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rec" aria-hidden="true" />
              Gravaí
            </span>
            <h2 id="instalar-titulo" className="text-lg font-bold leading-snug">
              {mode === "iphone" ? "No iPhone são 2 toques" : mode === "outro-app" ? "Abra no seu navegador" : "Pelo menu do navegador"}
            </h2>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="-mr-2 flex size-11 shrink-0 items-center justify-center">
            <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {mode === "iphone" && (
          <ol className="flex flex-col gap-3">
            <Step n={1}>
              Toque em <strong>Compartilhar</strong> <Share className={icon} strokeWidth={1.75} aria-hidden="true" /> na barra do Safari.
            </Step>
            <Step n={2}>
              Escolha <strong>Adicionar à Tela de Início</strong> <SquarePlus className={icon} strokeWidth={1.75} aria-hidden="true" />.
            </Step>
          </ol>
        )}

        {mode === "menu" && (
          <ol className="flex flex-col gap-3">
            <Step n={1}>
              Toque no menu <EllipsisVertical className={icon} strokeWidth={1.75} aria-hidden="true" /> do navegador.
            </Step>
            <Step n={2}>
              Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
            </Step>
          </ol>
        )}

        {mode === "outro-app" && (
          <>
            <p className="text-[15px] leading-relaxed">
              Por aqui, dentro de outro app, não dá para instalar. Copie o link e abra no <strong>Chrome</strong> ou no <strong>Safari</strong>: lá
              é só ir em Perfil e tocar em instalar de novo.
            </p>
            <button
              type="button"
              onClick={copy}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground font-semibold"
            >
              {copied ? <Check className="size-5" strokeWidth={1.75} aria-hidden="true" /> : <Copy className="size-5" strokeWidth={1.75} aria-hidden="true" />}
              {copied ? "Link copiado" : "Copiar o link"}
            </button>
          </>
        )}

        <p className="text-sm leading-relaxed text-muted-foreground">Depois o Gravaí abre com um toque, em tela cheia, como um app.</p>
        <button type="button" onClick={onClose} className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground">
          Entendi
        </button>
      </div>
    </div>
  );
}

// Perfil: item discreto para instalar. Some o botão quando o Gravaí já está aberto como app.
export function InstallItem() {
  const mode = useInstallMode();
  const [sheet, setSheet] = useState(false);

  if (mode === null) return null;

  async function open() {
    if (mode === "direto" && deferred) {
      const event = deferred;
      deferred = null; // o Chrome só deixa usar uma vez
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === "accepted") installed = true;
      notify();
      return;
    }
    setSheet(true);
  }

  const content = (
    <>
      <Smartphone className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="flex flex-1 flex-col">
        <span className="font-bold">{mode === "instalado" ? "App instalado" : "Instalar o app no celular"}</span>
        <span className="text-sm text-muted-foreground">
          {mode === "instalado" ? "Você já está usando o Gravaí como app" : "Abre com um toque, em tela cheia"}
        </span>
      </span>
      {mode === "instalado" && <Check className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
    </>
  );

  if (mode === "instalado") {
    return <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border p-4">{content}</div>;
  }

  return (
    <>
      <button type="button" onClick={open} className="flex min-h-14 items-center gap-3 rounded-2xl border border-border p-4 text-left">
        {content}
      </button>
      {sheet && mode !== "direto" && <Sheet mode={mode} onClose={() => setSheet(false)} />}
    </>
  );
}
