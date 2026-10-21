import type { CharacterSize, IntExt, TimeOfDay, WeatherRequirement } from "@/types/database";

// Resultado da leitura de um roteiro, antes de ir para o banco.
export interface ParsedScene {
  number: string;
  int_ext: IntExt;
  location_name: string;
  time_of_day: TimeOfDay;
  characters: string[];
  synopsis: string;
  pages: number; // em oitavos
  weather_requirement: WeatherRequirement;
  notes: string;
  order_index: number;
}

export interface ParsedCharacter {
  name: string;
  totalScenes: number;
  size: CharacterSize;
}

export interface ParsedLocation {
  name: string;
  isCovered: boolean;
  weatherRisk: "low" | "medium" | "high";
}

export interface ParsedScript {
  scenes: ParsedScene[];
  characters: ParsedCharacter[];
  locations: ParsedLocation[];
}

const INT_EXT: IntExt[] = ["INT", "EXT", "INT/EXT"];
const TIMES: TimeOfDay[] = ["DIA", "NOITE", "AMANHECER", "ENTARDECER"];
const WEATHER: WeatherRequirement[] = ["any", "sun", "cloudy", "rain", "snow", "wind", "fog"];

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  const v = typeof value === "string" ? value.trim().toUpperCase() : "";
  return allowed.find((a) => a.toUpperCase() === v) ?? fallback;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function characterName(value: string): string {
  return value.toUpperCase().replace(/\(.*?\)/g, "").trim();
}

export function sizeFor(totalScenes: number): CharacterSize {
  return totalScenes > 5 ? "protagonist" : totalScenes >= 2 ? "supporting" : "small";
}

// Personagens e locações saem das cenas, para os números baterem sempre.
export function buildScript(scenes: ParsedScene[]): ParsedScript {
  const counts = new Map<string, number>();
  for (const s of scenes) for (const c of s.characters) counts.set(c, (counts.get(c) ?? 0) + 1);

  const characters = [...counts].map(([name, totalScenes]) => ({ name, totalScenes, size: sizeFor(totalScenes) }));

  const locations = [...new Set(scenes.map((s) => s.location_name))].map((name) => {
    const isCovered = !scenes.some((s) => s.location_name === name && s.int_ext !== "INT");
    return { name, isCovered, weatherRisk: isCovered ? "low" : "medium" } as ParsedLocation;
  });

  return { scenes, characters, locations };
}

// Confere e completa o JSON que a IA devolve: nada fora dos valores aceitos pelo banco.
export function normalizeAiScript(raw: unknown): ParsedScript {
  const list = (raw as { scenes?: unknown })?.scenes;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("A IA não encontrou cenas neste roteiro.");
  }

  const scenes: ParsedScene[] = list.map((item, idx) => {
    const s = (item ?? {}) as Record<string, unknown>;
    const pages = Math.round(Number(s.pages));
    const chars = Array.isArray(s.characters) ? s.characters : [];
    return {
      number: text(s.number, String(idx + 1)),
      int_ext: pick(s.int_ext, INT_EXT, "INT"),
      location_name: text(s.location_name, "LOCAÇÃO SEM NOME").toUpperCase(),
      time_of_day: pick(s.time_of_day, TIMES, "DIA"),
      characters: [...new Set(chars.filter((c): c is string => typeof c === "string").map(characterName).filter(Boolean))],
      synopsis: text(s.synopsis),
      pages: Number.isFinite(pages) && pages > 0 ? pages : 8,
      weather_requirement: pick(s.weather_requirement, WEATHER, "any"),
      notes: text(s.notes),
      order_index: idx,
    };
  });

  // Número de cena repetido quebraria o unique (project_id, number).
  const seen = new Set<string>();
  for (const s of scenes) {
    let n = s.number;
    for (let i = 2; seen.has(n); i++) n = `${s.number}-${i}`;
    s.number = n;
    seen.add(n);
  }

  return buildScript(scenes);
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Lê um arquivo do Final Draft (.fdx) sem IA.
export function parseFdx(xml: string): ParsedScript | null {
  const paragraphs: { type: string; text: string }[] = [];
  const paragraphRegex = /<Paragraph[^>]*Type="([^"]*)"[^>]*>([\s\S]*?)<\/Paragraph>/g;
  let match;
  while ((match = paragraphRegex.exec(xml)) !== null) {
    const textRegex = /<Text[^>]*>([^<]*)<\/Text>/g;
    let textMatch;
    let content = "";
    while ((textMatch = textRegex.exec(match[2])) !== null) content += textMatch[1];
    content = decodeXml(content).trim();
    if (content) paragraphs.push({ type: match[1], text: content });
  }

  const scenes: ParsedScene[] = [];
  let current: ParsedScene | null = null;

  for (const p of paragraphs) {
    if (p.type === "Scene Heading") {
      if (current) scenes.push(current);

      const heading = p.text.toUpperCase();
      const intExt: IntExt =
        heading.startsWith("INT/EXT") || heading.startsWith("I/E") ? "INT/EXT" : heading.startsWith("EXT") ? "EXT" : "INT";

      const locAndTime = heading.replace(/^(INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)\s*/, "");
      const parts = locAndTime.split(/\s+-\s+/);
      const timeStr = parts.length > 1 ? parts[parts.length - 1] : "";

      let timeOfDay: TimeOfDay = "DIA";
      if (timeStr.includes("NOITE")) timeOfDay = "NOITE";
      else if (timeStr.includes("AMANHECER") || timeStr.includes("MANHÃ")) timeOfDay = "AMANHECER";
      else if (timeStr.includes("TARDE") || timeStr.includes("ENTARDECER")) timeOfDay = "ENTARDECER";

      const locationName = (parts.length > 1 ? parts.slice(0, -1).join(" - ") : locAndTime).trim();
      const index = scenes.length;

      current = {
        number: String(index + 1),
        int_ext: intExt,
        location_name: locationName || "LOCAÇÃO SEM NOME",
        time_of_day: timeOfDay,
        characters: [],
        synopsis: "",
        pages: 8,
        weather_requirement: intExt === "EXT" ? "sun" : "any",
        notes: "",
        order_index: index,
      };
    } else if (current) {
      if (p.type === "Character") {
        const name = characterName(p.text);
        if (name && name.length < 30 && isNaN(Number(name)) && !current.characters.includes(name)) {
          current.characters.push(name);
        }
      } else if (p.type === "Action" && !current.synopsis) {
        current.synopsis = p.text.length > 150 ? p.text.slice(0, 150) + "…" : p.text;
      }
    }
  }
  if (current) scenes.push(current);

  return scenes.length > 0 ? buildScript(scenes) : null;
}
