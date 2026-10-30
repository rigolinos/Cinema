import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { BlockKind } from "@/lib/roteiro";
import type { GuestRole, PersonRole } from "@/lib/pessoas";
import type { GuestShot } from "./acompanhar";

// A parte de uma pessoa, lida pelo código secreto do link. A página, a prévia (título e descrição)
// e a imagem do WhatsApp usam a mesma leitura; dentro de um pedido, o banco é chamado uma vez só.
export interface Part {
  person: { name: string; role: PersonRole; roles?: GuestRole[]; confirmed: boolean };
  video: { title: string; shoot_date: string | null; shoot_place: string | null; platform: string | null };
  creator: string | null; // nome completo de quem convidou; sem ele, o termo de imagem não pode ser aceito
  consented: boolean;
  // Quem só atua recebe só as partes em que aparece, com a deixa (última fala da parte anterior).
  blocks: { number: number; kind: BlockKind; label: string | null; speech: string; on_screen: string; action: string; mine: boolean; cue?: string | null }[];
  shots: GuestShot[]; // todos os planos, na ordem de gravação, com o que já foi gravado
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getPart = cache(async (token: string): Promise<Part | null> => {
  if (!UUID.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("shared_part", { p_token: token });
  return (data as Part | null) ?? null;
});

export function partRoles(part: Part): GuestRole[] {
  return part.person.roles?.length ? part.person.roles : [part.person.role as GuestRole];
}

export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? "";

// Quem foi convidado e quer fazer o próprio vídeo: o cadastro já vem com o nome e sabe que veio de um convite.
export function signupUrl(firstName: string): string {
  return `/register?${new URLSearchParams({ nome: firstName, origem: "convite" })}`;
}
