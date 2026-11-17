// Comparar textos sem IA: as palavras que contam, sem acento e pelo começo, para "sorri" e "sorrindo" serem a mesma.

const SMALL_WORDS = new Set(
  "a o as os e de da do das dos em na no nas nos um uma uns umas com para pra por que se ao aos à às sua seu suas seus ela ele eles elas eu você voce me te lhe isso isto esse essa este esta aquilo mas ou nem já ja só so mais muito bem aí ai lá la é foi ser está esta vai tem ter como quando depois antes então entao também tambem não nao sim".split(" "),
);

export function fold(text: string): string {
  return text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "");
}

export function contentWords(text: string): Set<string> {
  return new Set(
    fold(text)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 1 && !SMALL_WORDS.has(w))
      .map((w) => w.slice(0, 5)),
  );
}

// Quanto de `part` aparece em `whole`, de 0 a 1, pelas palavras que contam.
export function overlap(part: string, whole: string): number {
  const p = contentWords(part);
  if (p.size === 0) return 1;
  const w = contentWords(whole);
  return [...p].filter((x) => w.has(x)).length / p.size;
}
