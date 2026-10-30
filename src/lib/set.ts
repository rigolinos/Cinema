// Modo set: o que a tela de gravação precisa saber, sem depender de banco ou de tela.

// Abertura do set: uma dica curta por vez, sem nada para marcar.
export const SET_TIPS = [
  "Fique de frente para a luz, nunca de costas.",
  "Passe a camiseta na lente antes de começar.",
  "Ligue o Não perturbe: notificação estraga o take.",
  "Lugar sem eco e sem ventilador ligado.",
  "Celular com bateria e espaço sobrando.",
];

// A mesma dica para o mesmo vídeo (o sorteio pelo id não muda entre o servidor e a tela).
export function tipFor(videoId: string): string {
  let sum = 0;
  for (const ch of videoId) sum += ch.charCodeAt(0);
  return SET_TIPS[sum % SET_TIPS.length];
}

export interface SetShot {
  id: string;
  position: number;
  shoot_order: number | null;
  location: string;
  wardrobe: string;
  recorded: boolean;
  good_take: boolean;
  takes: number;
}

// Ordem do dia: a ordem de gravação montada nos Planos; sem ela, a do roteiro.
export function setOrder<T extends Pick<SetShot, "position" | "shoot_order">>(shots: T[]): T[] {
  return [...shots].sort((a, b) => (a.shoot_order ?? a.position + 1000) - (b.shoot_order ?? b.position + 1000) || a.position - b.position);
}

// Próximo plano ainda não gravado depois de `from` (dá a volta e retoma os pulados). -1 = acabou.
export function nextPending(shots: Pick<SetShot, "recorded">[], from: number): number {
  for (let step = 1; step <= shots.length; step++) {
    const i = (from + step) % shots.length;
    if (!shots[i].recorded) return i;
  }
  return -1;
}

export function firstPending(shots: Pick<SetShot, "recorded">[]): number {
  return shots.findIndex((s) => !s.recorded);
}

// Aviso quando o próximo plano é em outro lugar ou com outra roupa.
export function setupChange(prev: Pick<SetShot, "location" | "wardrobe"> | undefined, next: Pick<SetShot, "location" | "wardrobe">): string | null {
  if (!prev) return null;
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const parts: string[] = [];
  if (!same(prev.location, next.location) && next.location.trim()) parts.push(`vá para ${next.location.trim()}`);
  if (!same(prev.wardrobe, next.wardrobe) && next.wardrobe.trim()) parts.push(`troque para ${next.wardrobe.trim()}`);
  return parts.length ? `Troca de cenário: ${parts.join(" e ")}.` : null;
}

export function progress(shots: Pick<SetShot, "recorded" | "good_take">[]) {
  const recorded = shots.filter((s) => s.recorded).length;
  return {
    total: shots.length,
    recorded,
    good: shots.filter((s) => s.good_take).length,
    missing: shots.length - recorded,
    done: shots.length > 0 && recorded === shots.length,
  };
}
