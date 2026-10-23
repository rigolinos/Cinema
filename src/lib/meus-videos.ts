import { findFormat } from "./formats";
import { PLATFORMS, durationLabel, platformsLabel, videoPlatforms, type Platform } from "./ideas";
import { ANGLES, FRAMINGS, MOVEMENTS, shootingOrder, type Shot } from "./planos";
import { scriptAsText, type ScriptBlock } from "./roteiro";
import type { Video } from "@/types/database";

// Vídeo criado e abandonado: sem título, sem nenhuma resposta (o banco também confere se não há ideia sugerida).
export function isEmptyDraft(v: Pick<Video, "title" | "objective" | "platform" | "duration_s" | "resources">): boolean {
  return !v.title && !v.objective && !v.platform && !v.duration_s && (v.resources ?? []).length === 0;
}

export type VideoTab = "andamento" | "prontos" | "arquivados";

export function videoTab(v: Pick<Video, "stage"> & { archived_at?: string | null }): VideoTab {
  if (v.archived_at) return "arquivados";
  return v.stage === "pronto" ? "prontos" : "andamento";
}

// Pacote do vídeo em texto: para mandar no WhatsApp, guardar fora do app ou imprimir no set.
export function exportPackage(input: {
  video: Pick<Video, "title" | "hook" | "format_slug" | "platform" | "duration_s"> & { platforms?: Platform[] };
  blocks: ScriptBlock[];
  shots: (Pick<Shot, "block_id" | "position" | "shoot_order" | "framing" | "angle" | "movement" | "orientation" | "description" | "location" | "wardrobe" | "why"> & { id?: string })[];
  blockIds: string[];
  posts?: { platform?: Platform; title: string; caption: string; hashtags: string[]; cover_text: string; cover_idea: string }[];
}): string {
  const { video, blocks, shots, blockIds, posts = [] } = input;
  const title = video.title || "Vídeo";
  const format = findFormat(video.format_slug);
  const info = [format?.name, platformsLabel(videoPlatforms(video)) || null, video.duration_s ? durationLabel(video.duration_s) : null].filter(Boolean).join(" · ");
  const parts: string[] = [`GRAVAÍ · ${title.toUpperCase()}`];
  if (info) parts.push(info);
  if (video.hook) parts.push(`GANCHO: “${video.hook}”`);

  if (blocks.length) parts.push("━━ ROTEIRO ━━", scriptAsText(title, blocks).split("\n\n").slice(1).join("\n\n"));

  if (shots.length) {
    // Número do plano = ordem do roteiro (é a ordem da edição); a lista segue a ordem de gravação.
    const byScript = [...shots].sort((a, b) => blockIds.indexOf(a.block_id) - blockIds.indexOf(b.block_id) || a.position - b.position);
    const number = new Map(byScript.map((s, i) => [s, i + 1]));
    const ordered = shots.some((s) => s.shoot_order != null)
      ? [...shots].sort((a, b) => (a.shoot_order ?? 999) - (b.shoot_order ?? 999))
      : shootingOrder(byScript);
    const lines: string[] = ["━━ PLANOS (ORDEM DE GRAVAÇÃO) ━━"];
    let group = "";
    for (const s of ordered) {
      const place = [s.location.trim() || "Lugar não definido", s.wardrobe.trim()].filter(Boolean).join(" · ");
      if (place !== group) {
        lines.push("", `▸ ${place.toUpperCase()}`);
        group = place;
      }
      const tech = [FRAMINGS[s.framing].label, ANGLES[s.angle].label, MOVEMENTS[s.movement].label, s.orientation === "horizontal" ? "Horizontal" : "Vertical"].join(" · ");
      lines.push(`PLANO ${String(number.get(s)).padStart(2, "0")} · ${tech}`, `  ${s.description || FRAMINGS[s.framing].label}`);
      if (s.why) lines.push(`  Por quê: ${s.why}`);
    }
    parts.push(lines.join("\n"));
  }

  // Uma publicação por plataforma; a capa é a mesma para todas.
  const filled = posts.filter((p) => p.caption || p.title);
  for (const post of filled) {
    const pub = [filled.length > 1 && post.platform ? `━━ PUBLICAÇÃO · ${PLATFORMS[post.platform].toUpperCase()} ━━` : "━━ PUBLICAÇÃO ━━"];
    if (post.title) pub.push(`TÍTULO: ${post.title}`);
    if (post.caption) pub.push(`LEGENDA:\n${post.caption}`);
    if (post.hashtags.length) pub.push(post.hashtags.join(" "));
    parts.push(pub.join("\n"));
  }
  const cover = filled[0];
  if (cover?.cover_text) parts.push(`CAPA: “${cover.cover_text}”${cover.cover_idea ? ` (${cover.cover_idea})` : ""}`);

  return parts.join("\n\n");
}
