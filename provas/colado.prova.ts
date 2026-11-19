// Banco de provas do "Já tenho o roteiro": a leitura e a montagem de um roteiro colado com as cenas
// marcadas pela pessoa. Mede se as cenas dela ficam separadas, se a ordem da ação se mantém e se
// cada cena ganha cabeçalho. Só a reserva (Groq): 2 chamadas. Texto inventado, sem dado de ninguém.
//   PROVAS_SO=groq npx vitest run --config vitest.provas.config.ts provas/colado.prova.ts
import { readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { generateJson } from "../src/lib/ai";
import { assembleFromReading, faithful, normalizeReading, readingLines, readingSegments } from "../src/lib/leitura";
import { assembleTask, readingTask } from "../src/lib/prompts/tarefas";
import { context, tag } from "../src/lib/prompts/base";
import { sceneGroups, sceneHeading } from "../src/lib/roteiro";

for (const raw of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = raw.match(/^(GROQ_API_KEY|GROQ_MODEL)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const pasted = `O dia em que esqueci a prova
CENA 1 [Lia chega na sala correndo, todo mundo ja sentado e quieto]
Lia: bom dia gente
[o professor entrega uma folha pra ela sem falar nada]
CENA2 [Lia olha a folha e fica branca]
CENA 3 [no corredor ela liga pra mae]
LIA: mae vc lembra se tinha prova hj
MAE: tinha sim filha
CENA 4 [lia deitada no sofa de casa com a almofada na cara]`;

it("roteiro colado com cenas marcadas", async () => {
  const out: string[] = [];
  const log = (...a: unknown[]) => out.push(a.map(String).join(" "));
  const read = normalizeReading(await generateJson({ ...readingTask(), prompt: tag("roteiro_colado", pasted) }));
  expect(read).not.toBeNull();
  const reading = read!;
  log("fiel ao texto:", faithful(reading, pasted));
  log("cenas por item:", reading.items.map((i) => `${i.scene}:${i.kind}`).join(" "));
  log("cabeçalhos:", JSON.stringify(reading.headings));
  const rawAssembly = await generateJson({ ...assembleTask(), prompt: context([tag("itens", readingSegments(reading)), tag("leitura", readingLines(reading))]) });
  const blocks = assembleFromReading(reading, rawAssembly);
  expect(blocks).not.toBeNull();
  const groups = sceneGroups(blocks!);
  blocks!.forEach((b, i) => {
    const head = groups[i].show ? sceneHeading(groups[i].number, b.heading) : "   (continua)";
    log(`${head}\n   ação: ${b.action}\n   fala: ${b.speech.replace(/\n/g, " / ")}`);
  });
  log("cenas na tela:", groups.filter((g) => g.show).length, "de 4 marcadas");
  writeFileSync("provas/resultados/colado-reserva.md", ["# Roteiro colado com cenas marcadas (Groq)", "", "```", ...out, "```", ""].join("\n"));
}, 120_000);
