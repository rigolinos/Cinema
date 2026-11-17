import { generateJson, type AiRequest } from "./ai";
import { tag } from "./prompts/base";
import type { Problem } from "./qualidade";

// Pede, confere e, se a resposta veio com defeito, pede mais uma vez dizendo qual é o defeito.
// Fica com a versão que tiver menos problemas. Só gasta a segunda chamada quando a primeira veio ruim,
// e, se a segunda falhar (limite, formato), a primeira continua valendo.
export async function generateChecked<T>(
  req: AiRequest,
  o: { parse: (raw: unknown) => T | null; problems: (value: T) => Problem[] },
): Promise<{ value: T | null; problems: Problem[]; retried: boolean }> {
  const raw = await generateJson(req);
  const first = o.parse(raw);
  const found = first ? o.problems(first) : [{ code: "incompleto", fix: "A resposta veio sem os campos pedidos. Preencha todos." }];
  if (found.length === 0) return { value: first, problems: [], retried: false };

  try {
    const again = await generateJson({
      ...req,
      task: `${req.task ?? "tarefa"}-correcao`,
      prompt: [req.prompt, tag("sua_resposta_anterior", JSON.stringify(raw).slice(0, 4000)), tag("corrigir", ["Sua resposta anterior tem estes problemas. Reescreva a resposta inteira corrigindo cada um e mantendo o resto igual:", ...found.map((p) => `- ${p.fix}`)])].join("\n\n"),
    });
    const second = o.parse(again);
    if (second) {
      const left = o.problems(second);
      if (!first || left.length < found.length) return { value: second, problems: left, retried: true };
    }
  } catch {
    // sem segunda chance desta vez: segue a primeira
  }
  return { value: first, problems: found, retried: true };
}
