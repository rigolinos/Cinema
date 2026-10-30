// Link do convidado: as falas de cada pessoa com a deixa (a fala que vem antes), para saber quando entrar.
// O roteiro marca quem fala com "Nome: …" no começo da linha; uma parte marcada para a pessoa
// e sem nomes é toda dela.

export interface GuestBlock {
  number: number;
  label: string | null;
  speech: string;
  mine: boolean;
  cue: string | null; // última fala da parte anterior (vem do banco)
}

export interface CueLine {
  block: number;
  cue: string | null;
  text: string;
}

const SPEAKER = /^\s*([\p{L}][\p{L} ]{0,24}):\s*(.*)$/u;

export function speechLines(speech: string): { speaker: string | null; text: string; raw: string }[] {
  return speech
    .split(/\r?\n/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const m = raw.match(SPEAKER);
      return m ? { speaker: m[1].trim(), text: m[2].trim(), raw } : { speaker: null, text: raw, raw };
    });
}

const plain = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// "Kira" fala em "Kira:"; "Kira Souza" também (vale o primeiro nome).
export function isMe(speaker: string, name: string): boolean {
  return plain(speaker.split(/\s+/)[0]) === plain(name.split(/\s+/)[0] ?? "");
}

export function myLines(blocks: GuestBlock[], name: string): CueLine[] {
  const out: CueLine[] = [];
  for (const b of blocks) {
    if (!b.mine) continue;
    const lines = speechLines(b.speech);
    if (lines.length === 0) continue;
    if (!lines.some((l) => l.speaker)) {
      out.push({ block: b.number, cue: b.cue, text: lines.map((l) => l.text).join(" ") });
      continue;
    }
    lines.forEach((l, i) => {
      if (l.speaker && isMe(l.speaker, name)) out.push({ block: b.number, cue: i > 0 ? lines[i - 1].raw : b.cue, text: l.text });
    });
  }
  return out;
}
