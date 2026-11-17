// Roda o banco de provas com a IA de verdade e guarda o resultado em provas/resultados/.
//
//   PROVAS_ROTULO=base npm run provas
//   PROVAS_ROTULO=base-groq PROVAS_SO=groq npm run provas
//   PROVAS_ROTULO=leve PROVAS_SO=gemini PROVAS_MODELO=gemini-3.5-flash-lite npm run provas
//
// Cada caso faz 2 ou 3 chamadas (ideias, história e roteiro), com as chaves do .env.local: as mesmas do app.
// A nota não usa IA: conta o que dá para reconhecer no texto. O texto inteiro vai para um .md, para gente ler.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { generateJson, type AiMeta } from "../src/lib/ai";
import { generateChecked } from "../src/lib/ia-conferida";
import { normalizeIdeas } from "../src/lib/ideas";
import { draftRequest, ideasRequest, storyRequest } from "../src/lib/prompts/montagem";
import { castTag } from "../src/lib/prompts/tarefas";
import { draftProblems, ideaProblems, inventedShare, normalizePoints, quotedLines, storyProblems, tidyIdeas } from "../src/lib/qualidade";
import { maxWords, normalizeDraft, normalizeStory, polishBlock, wordCount } from "../src/lib/roteiro";
import { fold } from "../src/lib/texto";
import { CASES, type ProvaCase } from "./casos";

const only = process.env.PROVAS_SO; // "gemini" ou "groq": mede um fornecedor só
for (const raw of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = raw.match(/^(GEMINI_API_KEY|GROQ_API_KEY|GEMINI_MODEL|GROQ_MODEL)=(.*)$/);
  if (!m || process.env[m[1]]) continue;
  if (only === "groq" && m[1].startsWith("GEMINI")) continue;
  if (only === "gemini" && m[1].startsWith("GROQ")) continue;
  process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
if (process.env.PROVAS_MODELO) {
  if (only === "groq") process.env.GROQ_MODEL = process.env.PROVAS_MODELO;
  else process.env.GEMINI_MODELOS_CRIAR = process.env.PROVAS_MODELO;
}

const label = process.env.PROVAS_ROTULO ?? "rodada";
const wanted = process.env.PROVAS_CASOS?.split(",");
const pause = Number(process.env.PROVAS_PAUSA_MS ?? 6000);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Raw = { kind?: string; speech?: string; on_screen?: string; action?: string };
interface Step {
  step: "ideias" | "historia" | "roteiro";
  meta: AiMeta | null;
  error?: string;
  numbers: Record<string, number | string>;
  problems: string[];
  text: string;
}

const video = (c: ProvaCase) => ({ objective: c.objective, platforms: c.platforms, durationS: c.durationS, resources: c.resources, brief: c.ownIdea ?? "" });
const person = (c: ProvaCase) => ({ niche: c.niche, product: c.product, edge: c.edge, memory: c.memory ?? [] });
const people = (c: ProvaCase) => [{ name: c.cast?.me ?? "", role: "eu", roles: ["ator"] }, ...(c.cast?.guests ?? []).map((name) => ({ name, role: "ator", roles: ["ator"] }))];
const cast = (c: ProvaCase) => castTag(c.cast?.me, people(c));

// "dormir|cama": qualquer uma das alternativas conta.
function kept(points: string[], text: string) {
  const t = fold(text);
  return points.filter((p) => p.split("|").some((alt) => t.includes(fold(alt))));
}

async function ask(req: Parameters<typeof generateJson>[0]): Promise<{ data: unknown; meta: AiMeta | null }> {
  let meta: AiMeta | null = null;
  await wait(pause);
  const data = await generateJson({ ...req, log: (m) => void (meta = m) });
  return { data, meta };
}

it("banco de provas", { timeout: 3_600_000 }, async () => {
  const started = Date.now();
  const results: { id: string; steps: Step[] }[] = [];

  for (const c of CASES.filter((x) => !wanted || wanted.includes(x.id))) {
    const steps: Step[] = [];
    const fail = (step: Step["step"], err: unknown) => steps.push({ step, meta: null, error: (err as Error).message, numbers: {}, problems: ["falhou"], text: "" });
    let idea = { title: "", hook: "", situation: "", payoff: "", formatSlug: null as string | null };

    if (c.ownIdea) {
      // Como no app: quem escreve a ideia chega à história só com o texto dela e as primeiras palavras como começo.
      idea = { ...idea, title: c.ownIdea.split(/\s+/).slice(0, 6).join(" "), hook: c.ownIdea.slice(0, 120) };
    } else {
      try {
        const { data, meta } = await ask(ideasRequest({ video: video(c), person: person(c), cast: cast(c), seen: [], trends: [], seed: c.id }));
        const ideas = tidyIdeas(normalizeIdeas(data));
        if (ideas.length === 0) throw new Error("sem ideias");
        const problems = ideas.flatMap((i, n) => ideaProblems(i).map((p) => `ideia ${n + 1}: ${p.code}`));
        steps.push({
          step: "ideias",
          meta,
          numbers: { ideias: ideas.length, sem_final: ideas.filter((i) => !i.payoff?.trim()).length, com_pov: ideas.filter((i) => /\bpov\b/i.test(`${i.title} ${i.hook}`)).length },
          problems,
          text: ideas.map((i, n) => `${n + 1}. **${i.title}**\n   ${i.situation ?? ""}\n   Termina: ${i.payoff ?? ""}`).join("\n"),
        });
        const best = ideas[0];
        idea = { title: best.title, hook: best.hook, situation: best.situation ?? "", payoff: best.payoff ?? "", formatSlug: best.format_slug ?? null };
      } catch (err) {
        fail("ideias", err);
        results.push({ id: c.id, steps });
        continue;
      }
    }

    let story: { hook: string; situation: string; payoff: string } | null = null;
    try {
      const own = Boolean(c.ownIdea);
      const humor = c.objective === "divertir";
      let meta: AiMeta | null = null;
      let rawStory: unknown = null;
      await wait(pause);
      const checked = await generateChecked(
        { ...storyRequest({ video: { ...video(c), ...idea }, person: person(c), cast: cast(c), titled: own, own, seed: c.id }), log: (m) => void (meta = m) },
        {
          parse: (r) => {
            rawStory = r;
            return normalizeStory(r);
          },
          problems: (s) => storyProblems(s, { humor, ...(own ? { own: c.ownIdea, points: normalizePoints((rawStory as { pontos?: unknown })?.pontos, c.ownIdea ?? "") } : {}) }),
        },
      );
      story = checked.value;
      if (!story) throw new Error("sem história");
      const retriedStory = checked.retried;
      const text = [story.hook, story.situation, story.payoff].join("\n\n");
      const found = c.mustKeep ? kept(c.mustKeep, text) : [];
      steps.push({
        step: "historia",
        meta,
        numbers: { caracteres: text.length, falas_entre_aspas: quotedLines(text), pediu_correcao: retriedStory ? "sim" : "não", ...(own ? { inventado: `${Math.round(inventedShare(story, c.ownIdea ?? "") * 100)}%` } : {}), ...(c.mustKeep ? { pontos_da_pessoa: `${found.length}/${c.mustKeep.length}` } : {}) },
        problems: [...checked.problems.map((p) => p.code), ...(c.mustKeep ?? []).filter((p) => !found.includes(p)).map((p) => `faltou: ${p}`)],
        text,
      });
    } catch (err) {
      fail("historia", err);
      results.push({ id: c.id, steps });
      continue;
    }

    try {
      const names = [c.cast?.me.split(" ")[0] ?? "", ...(c.cast?.guests ?? [])].filter(Boolean);
      const limit = maxWords(c.durationS);
      let meta: AiMeta | null = null;
      let data: unknown = null;
      await wait(pause);
      const checked = await generateChecked(
        { ...draftRequest({ video: { ...video(c), ...idea, ...story }, person: person(c), cast: cast(c), seed: c.id }), log: (m) => void (meta = m) },
        {
          parse: (r) => {
            data = r;
            const list = normalizeDraft(r).map((b) => polishBlock(b, { names, me: names[0] ?? null }));
            return list.length ? list : null;
          },
          problems: (list) => draftProblems(list, { maxWords: limit, cast: names, story: [story!.hook, story!.situation, story!.payoff].join(" ") }),
        },
      );
      const raw = ((data as { blocks?: Raw[] } | null)?.blocks ?? []) as Raw[];
      const blocks = checked.value ?? [];
      if (blocks.length === 0) throw new Error("sem roteiro");
      const all = blocks.map((b) => [b.speech, b.on_screen, b.action].join("\n")).join("\n");
      const words = wordCount(blocks.map((b) => b.speech).join(" "));
      const found = c.mustKeep ? kept(c.mustKeep, all) : [];
      steps.push({
        step: "roteiro",
        meta,
        numbers: {
          cenas: blocks.length,
          cenas_com_cabecalho: `${blocks.filter((b) => b.heading).length}/${blocks.length}`,
          lugares: new Set(blocks.map((b) => (b.heading ?? "").replace(/\s*–.*$/, "")).filter(Boolean)).size,
          pediu_correcao: checked.retried ? "sim" : "não",
          palavras_de_fala: `${words}/${limit}`,
          cenas_com_corte_no_meio: raw.filter((b) => /\bCORTE\b|corta para/i.test(b.action ?? "")).length,
          voce_na_acao: raw.filter((b) => /\bvocê\b/i.test(b.action ?? "")).length,
          nome_em_minuscula: names.filter((n) => new RegExp(`(?<![\\p{L}])${n.toLowerCase()}(?![\\p{L}])`, "u").test(all)).length,
          ...(names.length > 1 ? { pessoas_com_fala: names.filter((n) => new RegExp(`^\\s*${n}\\s*:`, "im").test(blocks.map((b) => b.speech).join("\n"))).length + `/${names.length}` } : {}),
          ...(c.mustKeep ? { pontos_da_pessoa: `${found.length}/${c.mustKeep.length}` } : {}),
        },
        problems: [...checked.problems.map((p) => p.code), ...(c.mustKeep ?? []).filter((p) => !found.includes(p)).map((p) => `faltou: ${p}`)],
        text: blocks.map((b, n) => `**${n + 1}. ${b.heading ?? "sem cabeçalho"}** _${b.action}_\n${b.speech}${b.on_screen ? `\n[na tela] ${b.on_screen}` : ""}`).join("\n\n"),
      });
    } catch (err) {
      fail("roteiro", err);
    }
    results.push({ id: c.id, steps });
    console.log(`feito ${c.id}`);
  }

  const all = results.flatMap((r) => r.steps);
  const summary = {
    chamadas: all.length,
    falhas: all.filter((s) => s.error).length,
    problemas: all.reduce((n, s) => n + s.problems.length, 0),
    por_problema: all.flatMap((s) => s.problems.map((p) => p.replace(/^ideia \d+: /, "").replace(/^faltou: .*/, "ponto da pessoa faltando"))).reduce<Record<string, number>>((acc, p) => ({ ...acc, [p]: (acc[p] ?? 0) + 1 }), {}),
    quem_respondeu: all.reduce<Record<string, number>>((acc, s) => (s.meta ? { ...acc, [s.meta.model]: (acc[s.meta.model] ?? 0) + 1 } : acc), {}),
    pedidos_feitos: all.reduce((n, s) => n + (s.meta?.attempts ?? 1), 0),
    segundos_por_chamada: Math.round(all.reduce((n, s) => n + (s.meta?.ms ?? 0), 0) / Math.max(1, all.filter((s) => s.meta).length) / 100) / 10,
  };

  mkdirSync("provas/resultados", { recursive: true });
  writeFileSync(`provas/resultados/${label}.json`, JSON.stringify({ rotulo: label, data: new Date().toISOString(), minutos: Math.round((Date.now() - started) / 60000), resumo: summary, casos: results }, null, 2));
  const md = [
    `# Banco de provas: ${label}`,
    "",
    "```json",
    JSON.stringify(summary, null, 2),
    "```",
    ...results.flatMap((r) => [
      "",
      `## ${r.id}`,
      ...r.steps.flatMap((s) => [
        "",
        `### ${s.step}${s.meta ? ` · ${s.meta.model}, ${s.meta.attempts} pedido(s), ${Math.round(s.meta.ms / 100) / 10} s` : ""}`,
        s.error ? `**Falhou:** ${s.error}` : `Números: ${Object.entries(s.numbers).map(([k, v]) => `${k} ${v}`).join(" · ")}`,
        `Problemas: ${s.problems.length ? s.problems.join(", ") : "nenhum"}`,
        "",
        s.text,
      ]),
    ]),
  ].join("\n");
  writeFileSync(`provas/resultados/${label}.md`, md);
  console.log(JSON.stringify(summary, null, 2));
});
