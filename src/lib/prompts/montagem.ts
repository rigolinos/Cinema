// Montagem dos pedidos mais usados, num lugar só: as rotas e o teste que mostra o prompt final usam
// exatamente estas funções, então o que se revisa é o que vai para a IA.
import { findFormat } from "../formats";
import type { Objective, Platform, Resource } from "../ideas";
import { maxWords } from "../roteiro";
import { context, line, tag, usesHumor } from "./base";
import { draftTask, formatsTag, ideasTask, personTag, productTag, seenTag, trendsTag, videoTag, type Task } from "./tarefas";

interface Person {
  niche: string | null;
  product?: string | null;
  edge?: string | null;
  memory: string[];
}

interface VideoBase {
  objective: Objective;
  platforms: Platform[];
  durationS: number;
  resources: Resource[];
  brief: string;
}

export function ideasRequest(i: {
  video: VideoBase;
  person: Person;
  ask?: string;
  like?: string; // título da ideia em "Mais assim"
  seen: string[];
  trends: { title: string; what: string }[];
}): Task & { prompt: string } {
  const { video, person } = i;
  const task = ideasTask({ objective: video.objective, humor: usesHumor({ objective: video.objective, texts: [person.niche, video.brief, i.ask, ...person.memory] }) });
  const prompt = context([
    tag("pedido_agora", i.like ? `mais assim: "${i.like}"` : i.ask),
    tag("briefing", video.brief),
    videoTag(video),
    productTag(video.objective, { product: person.product, edge: person.edge }),
    personTag({ niche: person.niche, memory: person.memory }),
    seenTag(i.seen),
    trendsTag(i.trends),
    formatsTag(video.resources),
  ]);
  return { ...task, prompt };
}

export function draftRequest(i: {
  video: VideoBase & { title: string; hook: string; situation: string; payoff: string; formatSlug: string | null };
  person: Person;
}): Task & { prompt: string } {
  const { video, person } = i;
  const format = findFormat(video.formatSlug);
  const task = draftTask({ objective: video.objective, humor: usesHumor({ objective: video.objective, texts: [person.niche, video.brief, ...person.memory] }) });
  const prompt = context([
    tag("ideia", [
      line("Título", video.title),
      line("Gancho escolhido", video.hook),
      line("Situação", video.situation),
      line("Desfecho", video.payoff),
      format ? `Formato: "${format.name}". Estrutura: ${format.structure.join(" → ")}.` : null,
    ]),
    tag("limite", `No máximo ${maxWords(video.durationS)} palavras de fala no roteiro todo.`),
    tag("briefing", video.brief),
    videoTag(video),
    productTag(video.objective, { product: person.product, edge: person.edge }),
    personTag({ niche: person.niche, memory: person.memory }),
  ]);
  return { ...task, prompt };
}
