"use client";

import { useState } from "react";
import { useConfirm } from "@/components/gravai/confirm";
import { STEPS, Thinking } from "@/components/gravai/thinking";
import { newestChange, plansOutdated, shootingOrder, type Shot } from "@/lib/planos";
import { createClient } from "@/lib/supabase/client";

const keptKey = (videoId: string) => `gravai-planos-mantidos-${videoId}`;

function readKept(videoId: string): string | null {
  try {
    return localStorage.getItem(keptKey(videoId));
  } catch {
    return null;
  }
}

// O roteiro mudou depois dos planos: a pessoa decide, porque atualizar substitui o que ela mudou nos planos.
export function PlansOutdated<S extends Shot & { id: string; created_at?: string }>({
  videoId,
  blocks,
  shots,
  onUpdated,
}: {
  videoId: string;
  blocks: { updated_at?: string }[];
  shots: S[];
  onUpdated: (shots: S[]) => void;
}) {
  const [kept, setKept] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, sheet } = useConfirm();

  if (!plansOutdated(blocks, shots)) return null;
  const newest = newestChange(blocks);
  if (kept === newest || readKept(videoId) === newest) return null;

  function keep() {
    try {
      localStorage.setItem(keptKey(videoId), newest);
    } catch {}
    setKept(newest);
  }

  async function update() {
    if (!(await confirm({ title: "Atualizar os planos?", text: "Os planos novos substituem os atuais, inclusive o que você mudou neles.", action: "Atualizar" }))) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/planos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setError(data?.error ?? "Sem conexão. Tente de novo.");
      setBusy(false);
      return;
    }
    const fresh = data.shots as S[];
    await createClient().rpc("set_shoot_order", { p_video_id: videoId, p_shot_ids: shootingOrder(fresh).map((s) => s.id) });
    onUpdated(fresh);
    setBusy(false);
  }

  return (
    <section aria-label="O roteiro mudou" className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-foreground bg-card p-4">
      {sheet}
      <p className="font-semibold leading-snug">O roteiro mudou depois destes planos. Atualizar os planos?</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={update} disabled={busy} className="min-h-12 rounded-full bg-primary px-3 font-bold text-primary-foreground disabled:opacity-40">
          {busy ? <Thinking label="Atualizando" steps={STEPS.planos} /> : "Atualizar"}
        </button>
        <button type="button" onClick={keep} disabled={busy} className="min-h-12 rounded-full border-[1.5px] border-input px-3 font-semibold disabled:opacity-40">
          Manter
        </button>
      </div>
    </section>
  );
}
