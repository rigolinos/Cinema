// Lê um JSON que ainda está chegando e devolve os objetos já completos de uma lista
// (ex.: cada ideia de {"ideas":[{…},{…}]}), para a tela mostrar uma a uma.

export function completeItems(text: string, key: string): unknown[] {
  const at = text.indexOf(`"${key}"`);
  if (at === -1) return [];
  const open = text.indexOf("[", at);
  if (open === -1) return [];

  const items: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          items.push(JSON.parse(text.slice(start, i + 1)));
        } catch {
          // objeto quebrado: fica de fora; a resposta inteira é conferida no fim
        }
        start = -1;
      }
    } else if (c === "]" && depth === 0) break;
  }
  return items;
}
