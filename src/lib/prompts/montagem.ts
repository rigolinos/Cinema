// Montagem dos pedidos mais usados, num lugar só: as rotas e o teste que mostra o prompt final usam
// exatamente estas funções, então o que se revisa é o que vai para a IA.
import { findFormat } from "../formats";
import type { Objective, Platform, Resource } from "../ideas";
import { maxWords } from "../roteiro";
import { context, line, tag, usesHumor } from "./base";
import { mechanismsText, pickMechanisms } from "./mecanismos";
import { draftTask, formatsTag, ideasTask, personTag, productTag, seenTag, storyTask, trendsTag, videoTag, type Task } from "./tarefas";

interface Person {
  niche: string | null;
  product?: string | null;
  edge?: string | null;
  memory: string[];
}

// Os cartões de humor deste pedido: escolhidos pelo assunto e revezados pela semente (o id do vídeo).
function cardsFor(humor: boolean, seed: string | undefined, texts: (string | null | undefined)[]): string {
  return humor ? mechanismsText(pickMechanisms(seed ?? texts.join(" "), texts)) : "";
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
  cast?: string; // <pessoas>: quem aparece no vídeo
  ask?: string;
  like?: string; // título da ideia em "Mais assim"
  seen: string[];
  trends: { title: string; what: string }[];
  seed?: string;
}): Task & { prompt: string } {
  const { video, person } = i;
  const humor = usesHumor({ objective: video.objective, texts: [person.niche, video.brief, i.ask, ...person.memory] });
  const task = ideasTask({ objective: video.objective, humor, cards: cardsFor(humor, `${i.seed}:${i.seen.length}`, [person.niche, video.brief, i.ask]) });
  const prompt = context([
    tag("pedido_agora", i.like ? `mais assim: "${i.like}"` : i.ask),
    tag("briefing", video.brief),
    i.cast ?? "",
    videoTag(video),
    productTag(video.objective, { product: person.product, edge: person.edge }),
    personTag({ niche: person.niche, memory: person.memory }),
    seenTag(i.seen),
    trendsTag(i.trends),
    formatsTag(video.resources),
  ]);
  return { ...task, prompt };
}

export function storyRequest(i: {
  video: VideoBase & { title: string; hook: string; situation: string; payoff: string; formatSlug: string | null };
  person: Person;
  cast?: string;
  ask?: string;
  titled?: boolean; // quem escreveu a própria ideia ainda não tem um nome para o vídeo
  own?: boolean; // a história parte do texto da própria pessoa, não de uma ideia da IA
  seed?: string;
}): Task & { prompt: string } {
  const { video, person, ask } = i;
  const format = findFormat(video.formatSlug);
  const humor = usesHumor({ objective: video.objective, texts: [person.niche, video.brief, ask, ...person.memory] });
  const own = Boolean(i.own && video.brief.trim() && !ask);
  const task = storyTask({ objective: video.objective, titled: i.titled, own, humor, cards: cardsFor(humor && !own, i.seed, [person.niche, video.brief, video.title, video.situation]) });
  const parts = [line("Como começa", video.hook), line("O que acontece", video.situation), line("Como termina", video.payoff)];
  const prompt = context([
    tag("pedido_agora", ask),
    // Na ideia da própria pessoa não há começo escolhido: as primeiras palavras dela não são o começo do vídeo.
    own
      ? ""
      : tag(ask ? "historia_atual" : "ideia", [
          line("Título", video.title),
          ...parts,
          format ? `Formato: "${format.name}". Estrutura: ${format.structure.join(" → ")}.` : null,
        ]),
    own ? "" : tag("briefing", video.brief),
    i.cast ?? "",
    videoTag(video),
    productTag(video.objective, { product: person.product, edge: person.edge }),
    personTag({ niche: person.niche, memory: person.memory }),
    // Por último, para ficar colado na resposta: é a fonte da história.
    own ? tag("ideia_da_pessoa", video.brief) : "",
  ]);
  return { ...task, prompt };
}

export function draftRequest(i: {
  video: VideoBase & { title: string; hook: string; situation: string; payoff: string; formatSlug: string | null };
  person: Person;
  cast?: string;
  seed?: string;
}): Task & { prompt: string } {
  const { video, person } = i;
  const format = findFormat(video.formatSlug);
  // O roteiro só organiza a história já aprovada: sem cartões, para não puxar piada nova.
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
    i.cast ?? "",
    videoTag(video),
    productTag(video.objective, { product: person.product, edge: person.edge }),
    personTag({ niche: person.niche, memory: person.memory }),
  ]);
  return { ...task, prompt };
}
