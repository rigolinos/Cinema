// Prompts v3: as tarefas. Cada uma diz o que entregar; o system junta mestre, submestre e humor (base.ts).
// Valores fechados (tipos de bloco, formatos, objetivos, enquadramentos) vêm das mesmas listas
// que a normalização aceita, para schema e normalização nunca discordarem.
import type { Thinking } from "../ai";
import { FORMATS } from "../formats";
import { OBJECTIVES, PLATFORMS, RESOURCES, durationLabel, platformsLabel, type Objective, type Platform, type Resource } from "../ideas";
import { ANGLES, FRAMINGS, MOVEMENTS, type Term } from "../planos";
import { BLOCK_KINDS } from "../roteiro";
import { buildSystem, line, tag } from "./base";

export interface Task {
  system: string;
  schema: object;
  example: string; // o mesmo formato como JSON de exemplo, para o Groq
  thinking: Thinking;
  temperature: number;
}

// ── Listas fechadas ──────────────────────────────────────────────────────
export const KIND_VALUES = Object.keys(BLOCK_KINDS);
export const FORMAT_VALUES = FORMATS.map((f) => f.slug);
export const OBJECTIVE_VALUES = Object.keys(OBJECTIVES);
export const FIELD_VALUES = ["speech", "on_screen", "action"];
export const FRAMING_VALUES = Object.keys(FRAMINGS);
export const ANGLE_VALUES = Object.keys(ANGLES);
export const MOVEMENT_VALUES = Object.keys(MOVEMENTS);
export const ORIENTATION_VALUES = ["vertical", "horizontal"];

// Schema do Gemini (subconjunto do OpenAPI).
const STR = { type: "STRING" };
const INT = { type: "INTEGER" };
const strs = { type: "ARRAY", items: STR };
const oneOf = (values: string[]) => ({ type: "STRING", enum: values });
const obj = (properties: Record<string, object>, required = Object.keys(properties)) => ({ type: "OBJECT", properties, required });
const list = (item: object) => ({ type: "ARRAY", items: item });
const formatSlug = { type: "STRING", enum: FORMAT_VALUES, nullable: true };

// POV é mal usado de propósito nas redes: a IA precisa conhecer os dois sentidos e não escrever POV em tudo.
const POV_RULE = `- POV é só um dos formatos: é o ponto de vista de quem está atrás da câmera, como se ela fosse os olhos de outra pessoa. Quem aparece olha e reage para a câmera, e quem está atrás dela pode ter falas sem aparecer. Não é necessariamente quem assiste. Nas redes, muita gente escreve "POV:" só como legenda de uma situação; isso é linguagem da internet, não o formato. Não coloque "POV" no título nem no gancho por padrão, e no máximo 1 ideia em cada 5 usa esse formato. Varie: plano e contraplano, plano-sequência, esquete com cortes, narração sobre a cena.`;

// ── Ideias do zero, outras ideias, mais assim ───────────────────────────
const IDEAS_TEXT = `TAREFA: sugerir 5 ideias de vídeo para esta pessoa, prontas para virar roteiro.
- Se houver briefing ou pedido, as 5 seguem esse caminho. Varie a situação, o ângulo e o personagem, nunca o gênero que a pessoa pediu.
- Sem briefing, varie: tipos diferentes de vídeo que combinem com o nicho, o objetivo e o que se sabe da pessoa.
- "Mais assim" sobre uma ideia: as 5 são variações dela, com a mesma essência e outra situação, outro começo ou outra virada.
- "Outras ideias": as 5 são diferentes de todas as que a pessoa já viu, não versões delas.
- No objetivo Vender, toda ideia usa o produto e o diferencial que a pessoa contou.
- Formatos e tendências são sugestão. Uma ótima ideia fora de formato vale mais que uma fraca dentro de um.
${POV_RULE}
- Entregue da mais forte para a menos forte: a primeira é a sua melhor aposta para esta pessoa.

Cada ideia traz:
- title: curto, para a pessoa lembrar (até 8 palavras);
- situation: a cena ou o conteúdo, em 1 ou 2 frases concretas;
- hook: a frase exata ou a imagem dos primeiros 3 segundos (até 12 palavras);
- payoff: o desfecho exato (a virada, o resultado, a dica ou a oferta); vazio só se o vídeo não tiver;
- why: por que funciona para este objetivo, em uma frase;
- format_slug: um formato da lista, se algum servir de verdade; senão, vazio.`;

const IDEA_FIELDS = { title: STR, situation: STR, hook: STR, payoff: STR, why: STR, format_slug: formatSlug };

export function ideasTask(o: { objective: Objective; humor: boolean }): Task {
  return {
    system: buildSystem({ objective: o.objective, humor: o.humor, task: IDEAS_TEXT }),
    schema: obj({ ideas: list(obj(IDEA_FIELDS, ["title", "situation", "hook", "payoff", "why"])) }),
    example: `{"ideas":[{"title":"","situation":"","hook":"","payoff":"","why":"","format_slug":""}]}`,
    thinking: "medio",
    temperature: 0.9,
  };
}

// ── Quinzena ─────────────────────────────────────────────────────────────
const FORTNIGHT_TEXT = `TAREFA: sugerir 6 ideias para as próximas duas semanas desta pessoa, sem ela ter pedido.
- A mistura vem pronta no pedido, no bloco <mistura>.
- "Fora do padrão" continua no nicho da pessoa, mas num formato ou ângulo que ela ainda não fez. É para ela experimentar, não para mudar de assunto.
- Pelo menos 3 dão para gravar com os recursos de sempre dela.
- Cada ideia é julgada pelos critérios do objetivo dela e diz qual é em objective.
- Não repita nem disfarce ideias que a pessoa já viu.
${POV_RULE}
- Entregue da mais forte para a menos forte: a primeira é a sua melhor aposta para esta pessoa.

Cada ideia traz os mesmos campos das ideias do zero, mais objective (divertir, vender, ensinar ou crescer):
- title: curto (até 8 palavras); situation: a cena em 1 ou 2 frases concretas; hook: os primeiros 3 segundos (até 12 palavras); payoff: o desfecho exato, vazio só se não houver; why: por que funciona, em uma frase; format_slug: um formato da lista, se servir; senão, vazio.`;

export function fortnightTask(o: { humor: boolean }): Task {
  return {
    system: buildSystem({ criteria: true, humor: o.humor, task: FORTNIGHT_TEXT }),
    schema: obj({ ideas: list(obj({ objective: oneOf(OBJECTIVE_VALUES), ...IDEA_FIELDS }, ["objective", "title", "situation", "hook", "payoff", "why"])) }),
    example: `{"ideas":[{"objective":"","title":"","situation":"","hook":"","payoff":"","why":"","format_slug":""}]}`,
    thinking: "medio",
    temperature: 0.9,
  };
}

// ── Organizador (já tenho o roteiro): sem mestre, só classifica ──────────
const ORGANIZER_SYSTEM = `Você organiza roteiros de vídeo curto. Você não escreve, não melhora e não corrige nada: só classifica.

O roteiro no pedido foi escrito pela pessoa e já está dividido em trechos numerados. Para cada trecho, diga:
- block: em qual bloco ele fica. Blocos são numerados a partir de 1, na ordem do texto. Trechos seguidos que fazem a mesma coisa ficam no mesmo bloco.
- kind: o tipo do bloco: gancho, contexto, conteudo, virada ou chamada.
- field: speech (o que é falado), on_screen (texto que aparece escrito na tela) ou action (o que acontece em cena).

Regras:
- O primeiro bloco é o gancho. Use só os tipos que existirem; um roteiro pode não ter virada nem chamada.
- Trecho marcado como cena (entre colchetes, "(cena: …)" ou parecido) é action. Marcado como tela ou texto é on_screen. Sem marca, é speech.
- Marcação de quem fala ("Mãe:", "Ela:") fica no próprio trecho, como speech.
- Na dúvida sobre o tipo, use conteudo.
- Todo trecho aparece uma vez, na ordem.

title: um título curto (até 6 palavras) que resuma o vídeo, para a lista de vídeos.`;

export function organizerTask(): Task {
  return {
    system: ORGANIZER_SYSTEM,
    schema: obj({ title: STR, segments: list(obj({ n: INT, block: INT, kind: oneOf(KIND_VALUES), field: oneOf(FIELD_VALUES) })) }),
    example: `{"title":"","segments":[{"n":1,"block":1,"kind":"gancho","field":"speech"}]}`,
    thinking: "zero",
    temperature: 0.2,
  };
}

// ── Roteiro colado, em duas chamadas: a leitura e a montagem ────────────
// 1ª chamada: a IA lê o texto do jeito que a pessoa escreveu e faz para si mesma uma versão
// estruturada. Ninguém vê esta versão; ela existe para a montagem (e os outros passos) entender o roteiro.
const READING_SYSTEM = `Você lê roteiros de vídeo curto escritos às pressas, no bloco de notas: sem pontuação, com erro de digitação, com fala, cena e indicação de câmera misturadas na mesma linha. Sua tarefa é entender o roteiro e reescrevê-lo em itens, para você mesmo usar depois. Você não melhora nem muda a história.

items: o roteiro inteiro, na ordem em que foi escrito, um item para cada coisa:
- kind "fala": o que alguém diz. speaker: o nome de quem fala, se o roteiro disser ("Natasha: …" → Natasha); senão, vazio.
- kind "tela": texto que aparece escrito na tela (título, legenda, "POV: …").
- kind "acao": o que acontece em cena (quem faz o quê, reação, cenário).
- kind "camera": indicação de câmera que a pessoa escreveu ("plano aberto", "close na mão", "câmera tremendo").
Uma linha que mistura coisas vira vários itens. Ex.: "manu e lorenzo discutindo (plano aberto) natasha sai de tras de um banco" → acao "Manu e Lorenzo discutindo.", camera "plano aberto", acao "Natasha sai de trás de um banco."

No text de cada item:
- Corrija erro de ortografia, de digitação e de acento, e ponha pontuação e maiúscula: "nem sabe o q eu vi" → "Nem sabe o que eu vi".
- Abreviação de digitação vira a palavra que se fala: "q" → "que", "mt" → "muito", "vc" → "você", "oq" → "o quê".
- O jeito de falar NÃO é erro e fica igual, só com acento: "ta" → "tá" (nunca "está"), "to" → "tô", "pra", "pro" (nunca "para o"), "né", "cê", letra esticada ("mentiraaa", "simmm"), "kkkk".
  Certo: "todo mundo ja ta sabendo" → "Todo mundo já tá sabendo." Errado: "Todo mundo já está sabendo."
- Mantenha o jeito dela: gírias, palavrões, expressões, palavras em inglês (estas entre aspas: "relatable") e a ordem das palavras. Não troque palavra por sinônimo, não resuma, não acrescente frase. Emoji vira a palavra do que ele mostra só em ação ("cara de 😱" → "cara de susto").
- Nada fica de fora: todo o texto colado aparece em algum item.

summary: do que o vídeo trata, em 1 ou 2 frases. tone: o tom em poucas palavras ("humor, fofoca de escola"). people: os nomes de quem aparece ou fala, como estão no roteiro.`;

export function readingTask(): Task {
  return {
    system: READING_SYSTEM,
    schema: obj({ summary: STR, tone: STR, people: strs, items: list(obj({ kind: oneOf(["fala", "tela", "acao", "camera"]), speaker: STR, text: STR })) }),
    example: `{"summary":"","tone":"","people":[],"items":[{"kind":"fala","speaker":"","text":""}]}`,
    thinking: "baixo",
    temperature: 0.2,
  };
}

// 2ª chamada: com a leitura na mão, a IA só decide as partes. O campo de cada item já vem do tipo.
const ASSEMBLE_SYSTEM = `Você organiza roteiros de vídeo curto em partes. O roteiro no pedido já foi lido e está em itens numerados, cada um com o tipo (fala, tela, acao ou camera) e quem fala. Você não escreve nada novo: só diz em que parte cada item fica.

Para cada item:
- block: em qual parte ele fica. Partes são numeradas a partir de 1, na ordem do roteiro. Itens seguidos que fazem a mesma coisa na história ficam na mesma parte; uma conversa curta fica inteira numa parte.
- kind: o papel da parte: gancho (o começo que prende), contexto (situa quem assiste), conteudo (o miolo), virada (a surpresa, o resultado ou a revelação) ou chamada (o pedido final).

Regras:
- A primeira parte é o gancho. Use só os papéis que existirem; um roteiro pode não ter virada nem chamada.
- Entre 2 e 8 partes, conforme o tamanho do roteiro.
- Todo item aparece uma vez, na ordem.

labels: um nome curto (até 3 palavras) para cada parte, na ordem, tirado do que acontece nela ("A fofoca", "Flagra na quadra").
title: um título curto (até 6 palavras) que resuma o vídeo, para a lista de vídeos.`;

export function assembleTask(): Task {
  return {
    system: ASSEMBLE_SYSTEM,
    schema: obj({ title: STR, labels: strs, items: list(obj({ n: INT, block: INT, kind: oneOf(KIND_VALUES) })) }),
    example: `{"title":"","labels":[""],"items":[{"n":1,"block":1,"kind":"gancho"}]}`,
    thinking: "zero",
    temperature: 0.2,
  };
}

// ── Sugestões por bloco ──────────────────────────────────────────────────
const SUGGESTIONS_TEXT = `TAREFA: revise o roteiro desta pessoa como um roteirista sênior revisaria o texto de um colega que respeita: com honestidade, pouco e onde importa. O roteiro é dela, e o jeito de falar dela fica.
- Sugira só onde fizer diferença de verdade para o objetivo do vídeo. No máximo 4 sugestões no roteiro inteiro e no máximo 1 por bloco. Bloco que já está bom fica sem sugestão.
- Prioridades, nesta ordem: (1) o gancho prende nos primeiros 3 segundos? (2) a virada, o resultado ou a oferta está clara? (3) há algo que dura demais ou se repete? (4) a chamada final, se o objetivo pedir uma, é uma só e clara? (5) dá para mostrar em vez de explicar?
- Cada sugestão reescreve o bloco inteiro com o mínimo de mudança, mantendo as palavras, as gírias e as marcações de quem fala. Nunca troque a piada, o produto ou a opinião dela.
- reason: uma frase curta, falando com a pessoa e com o efeito que ela ganha ("Seu gancho chega aos 6 segundos; trazendo a frase da mãe para o começo, ele prende logo de cara").
- Se o roteiro já estiver forte, diga isso e sugira no máximo 1 coisa, ou nenhuma.
- note: um comentário geral, em uma ou duas frases e no tom de parceiro: o que funciona e, se houver, a principal melhoria.
- block: o número do bloco como aparece no pedido (o primeiro é 1).`;

export function suggestionsTask(o: { objective: Objective; humor: boolean }): Task {
  return {
    system: buildSystem({ objective: o.objective, humor: o.humor, task: SUGGESTIONS_TEXT }),
    schema: obj({ note: STR, suggestions: list(obj({ block: INT, speech: STR, on_screen: STR, action: STR, reason: STR })) }),
    example: `{"note":"","suggestions":[{"block":1,"speech":"","on_screen":"","action":"","reason":""}]}`,
    thinking: "medio",
    temperature: 0.7,
  };
}

// ── Rascunho do roteiro ──────────────────────────────────────────────────
const DRAFT_TEXT = `TAREFA: escreva o roteiro completo desta ideia, pronto para gravar.
- Respeite o título, o gancho escolhido, a situação e o desfecho: foram decididos pela pessoa. O primeiro bloco usa o gancho escolhido.
- Quando a situação e o desfecho contam o vídeo cena a cena, siga essa ordem e use essas piadas e viradas. Não invente outro desenrolar.
- Limite rígido: no máximo o número de palavras de fala do bloco <limite>, no roteiro todo. Conte antes de responder.
- Divida em blocos do tipo gancho, contexto, conteudo, virada e chamada. Use só os que o vídeo precisa.
- A chamada final segue o objetivo: obrigatória em Vender, Ensinar e Crescer, pedindo uma coisa só; opcional em Divertir.
- Em cada bloco: speech (exatamente o que se fala, como a pessoa falaria), on_screen e action (o que acontece em cena, em uma frase).
- on_screen é só o texto escrito que aparece sobre o vídeo, palavra por palavra: título ou legenda. Deixe vazio se não houver. "Natasha correndo" ou "hambúrguer na mão" descrevem a cena e vão em action.
- label: o nome curto do bloco, até 3 palavras ("Erro 1"), usado no título do bloco, nos Planos e no teleprompter. Opcional no gancho e na chamada.
- Se mais de uma pessoa fala no bloco, comece cada fala com quem fala ("Você: …", "Amiga: …").
- A virada, o resultado ou a oferta aparecem escritos de verdade, nunca "aqui entra o final".
- Use o que já sabemos sobre o jeito de falar da pessoa.`;

const BLOCK_FIELDS = { kind: oneOf(KIND_VALUES), label: STR, speech: STR, on_screen: STR, action: STR };

export function draftTask(o: { objective: Objective; humor: boolean }): Task {
  return {
    system: buildSystem({ objective: o.objective, humor: o.humor, task: DRAFT_TEXT }),
    schema: obj({ blocks: list(obj(BLOCK_FIELDS)) }),
    example: `{"blocks":[{"kind":"gancho","label":"","speech":"","on_screen":"","action":""}]}`,
    thinking: "medio",
    temperature: 0.8,
  };
}

// ── A história, antes do roteiro ────────────────────────────────────────
const STORY_TEXT = `TAREFA: conte o vídeo inteiro, do começo ao fim, para a pessoa decidir se gosta dele antes de existir um roteiro. Escreva como quem conta o vídeo para um amigo: no presente, em texto corrido e concreto.
- hook: como começa, os primeiros segundos, em uma frase. Mantenha o gancho escolhido, salvo se o pedido mudar isso.
- situation: o que acontece, em ordem, em até 5 frases curtas e até 500 caracteres. Cada frase é um acontecimento que dá para ver ou ouvir.
- payoff: como termina, em 1 ou 2 frases: a virada, o resultado, a dica ou a oferta, e o último momento do vídeo.
- Entregue o conteúdo de verdade, nunca a descrição dele. Se ensina, diga o que é ensinado. Se vende, mostre como o produto entra e qual é a oferta.
- Se tem humor, é aqui que a pessoa decide se ri. Traga pelo menos duas piadas prontas, cada uma com a fala entre aspas ou o gesto exato, e escale: a segunda é mais absurda que a primeira. "Ela entra em pânico" não é piada; "ela revista o próprio sapato e pergunta para o vizinho se ele viu a chave passar" é. Sentimento sem ação não conta.
- Sem palavras técnicas: nada de plano, corte, take, gancho ou bloco. Sem tempos e sem marcação de quem fala.
- Tem que caber na duração e ser possível com o que a pessoa tem em <video>.
- Se houver <briefing>, é a ideia que a pessoa contou, e a história é a dela: não troque a ideia nem o que ela escreveu. Complete só o que faltar, inclusive o final, se ela não disse qual é.
- Se houver <historia_atual> e <pedido_agora>, mude só o que foi pedido e mantenha o resto igual, palavra por palavra.
- Se o pedido escrito pela pessoa pedir algo que as regras de segurança proíbem, atenda o resto e deixe essa parte de fora.`;

export function storyTask(o: { objective: Objective; humor: boolean; titled?: boolean }): Task {
  const title = "\n- title: um nome curto para este vídeo, até 8 palavras, concreto e sem a palavra POV.";
  return {
    system: buildSystem({ objective: o.objective, humor: o.humor, task: o.titled ? STORY_TEXT + title : STORY_TEXT }),
    schema: obj({ ...(o.titled ? { title: STR } : {}), hook: STR, situation: STR, payoff: STR }),
    example: o.titled ? `{"title":"","hook":"","situation":"","payoff":""}` : `{"hook":"","situation":"","payoff":""}`,
    thinking: "medio",
    temperature: 0.8,
  };
}

// ── Ajuste de bloco ──────────────────────────────────────────────────────
const REWRITE_TEXT = `TAREFA: o roteiro inteiro vem no pedido, e o bloco a mudar está marcado com >>>. Reescreva só esse bloco, atendendo exatamente ao pedido.
- Mantenha o papel do bloco no roteiro (um gancho continua sendo gancho) e o tom dos outros blocos.
- Mude o mínimo para cumprir o pedido. O gancho continua prometendo o que o fim entrega.
- "Mais curto" quer dizer cortar palavras, não reescrever com outras.
- Mantenha as palavras, as gírias e as marcações de quem fala sempre que possível.
- Se o pedido escrito pela pessoa pedir algo que as regras de segurança proíbem, atenda o resto e deixe essa parte de fora.`;

export function rewriteTask(o: { objective: Objective; humor: boolean }): Task {
  return {
    system: buildSystem({ objective: o.objective, humor: o.humor, task: REWRITE_TEXT }),
    schema: obj({ speech: STR, on_screen: STR, action: STR }),
    example: `{"speech":"","on_screen":"","action":""}`,
    thinking: "baixo",
    temperature: 0.8,
  };
}

// ── Planos ───────────────────────────────────────────────────────────────
const SHOTS_TEXT = `TAREFA: você é o diretor que ajuda a pessoa a dividir cada bloco do roteiro nas tomadas que ela vai gravar com o celular. Planos simples e possíveis de fazer; varie os enquadramentos sem complicar.
- Planos não são os blocos repetidos. Pergunte o que a câmera precisa filmar para a edição funcionar: um bloco pode pedir vários planos, e dois blocos podem usar o mesmo.
- Diálogo: as falas vêm marcadas com quem fala ("Bia: oi"). Cada pessoa que fala aparece em pelo menos um plano. Com duas pessoas, use plano e contraplano (um plano de cada uma) ou um plano com as duas. Quem ouve ganha um plano de reação quando a reação faz a cena funcionar.
- description diz o que a câmera vê naquele plano: quem está em quadro e o que faz. Não é um resumo da cena. Sempre pelo nome, quando houver.
- Cada plano mostra uma ação só, de um enquadramento só. Mão pegando o controle e depois o rosto reagindo são dois planos. No total, no máximo o número do bloco <limite>.
- O enquadramento combina com o que aparece: detalhe mostra só um objeto ou uma mão, sem rosto; reação e expressão pedem close. Se a descrição não couber no enquadramento, divida ou troque.
- Quem grava sozinho não tem câmera acompanhando.
- Use só os valores permitidos de enquadramento, ângulo e movimento listados no pedido.
- O gancho começa em close ou detalhe.
- Mesmo nome de local quando for o mesmo lugar. Roupa só se mudar.
- Se houver <leitura> com indicações de câmera que a pessoa escreveu ("plano aberto", "close na mão"), elas valem: use esse enquadramento nesse momento.
- people: quem está em quadro naquele plano, só com nomes de <pessoas>. A mão ou o corpo de alguém conta; quem só fala fora de quadro não conta. Plano só de objeto ou de lugar, ou sem <pessoas>: lista vazia.
- why: uma frase, para quem está aprendendo.
- block: o número do bloco (o primeiro é 1).`;

const SHOT_RULES: Record<Objective, string> = {
  divertir: "Regra do objetivo deste vídeo: a virada tem um plano de reação: o rosto em close, se a pessoa aparece; senão, o gesto ou o objeto que mostra a reação.",
  vender: "Regra do objetivo deste vídeo: o produto aparece em close pelo menos uma vez, e o plano da prova (antes e depois ou demonstração) não pode faltar.",
  ensinar: "Regra do objetivo deste vídeo: o passo principal aparece em detalhe, nas mãos ou na tela.",
  crescer: "Regra do objetivo deste vídeo: o gancho mostra a marca da pessoa: o rosto, se ela aparece; senão, as mãos, a voz ou o cenário de sempre.",
};

export function shotsTask(o: { objective: Objective | null }): Task {
  return {
    system: buildSystem({ task: o.objective ? `${SHOTS_TEXT}\n\n${SHOT_RULES[o.objective]}` : SHOTS_TEXT }),
    schema: obj({
      shots: list(
        obj({
          block: INT,
          framing: oneOf(FRAMING_VALUES),
          angle: oneOf(ANGLE_VALUES),
          movement: oneOf(MOVEMENT_VALUES),
          orientation: oneOf(ORIENTATION_VALUES),
          description: STR,
          location: STR,
          wardrobe: STR,
          why: STR,
          people: list(STR),
        }),
      ),
    }),
    example: `{"shots":[{"block":1,"framing":"","angle":"","movement":"","orientation":"vertical","description":"","location":"","wardrobe":"","why":"","people":[]}]}`,
    thinking: "baixo",
    temperature: 0.6,
  };
}

// ── Publicação ───────────────────────────────────────────────────────────
// Limites com folga: o app corta na última frase completa se a IA passar do limite de verdade.
export const POST_LIMITS: Record<Platform, { caption: number; title: number }> = {
  reels: { caption: 250, title: 0 },
  tiktok: { caption: 130, title: 0 },
  shorts: { caption: 300, title: 60 },
  youtube: { caption: 500, title: 60 },
};

const POST_TEXT = `TAREFA: escreva o texto que acompanha o vídeo em cada plataforma pedida, a serviço do objetivo. Aqui a regra de emoji muda: no máximo 2 por texto.

Pelo objetivo:
- Divertir: legenda curta que puxa comentário ou marcação, ligada à situação do vídeo ("marca quem faz isso no grupo da família").
- Vender: a primeira linha traz o benefício; depois o diferencial e uma chamada clara ("chama no direct", "link na bio").
- Ensinar: o aprendizado em uma linha e um motivo para salvar.
- Crescer: o que o perfil oferece e um motivo para seguir.

A chamada é específica deste vídeo. É proibido fecho genérico como "curta e siga para mais dicas", "deixe seu like" ou "não esqueça de seguir". Se o roteiro tem chamada final, a última frase da legenda repete essa chamada.

Por plataforma (os números já têm folga; não passe deles):
- Reels: até 250 caracteres, a primeira linha prende antes do "mais", 3 a 5 hashtags, sem título.
- TikTok: até 130 caracteres, direto, 3 a 5 hashtags.
- Shorts: título de até 60 caracteres e descrição de 1 ou 2 frases.
- YouTube: título de até 60 caracteres e descrição de 2 ou 3 frases.

Hashtags específicas do assunto e do nicho, nunca genéricas (#viral, #fyp). A capa é uma só para todas as plataformas: cover_text (até 5 palavras) e cover_idea (a imagem, em uma frase).`;

export function postTask(o: { objective: Objective | null; platforms: Platform[] }): Task {
  const platforms: Platform[] = o.platforms.length ? o.platforms : ["reels"];
  const post = obj({ caption: STR, title: STR, hashtags: strs });
  return {
    system: buildSystem({ objective: o.objective, task: POST_TEXT }),
    schema: obj({ cover_text: STR, cover_idea: STR, posts: obj(Object.fromEntries(platforms.map((p) => [p, post]))) }),
    example: `{"cover_text":"","cover_idea":"","posts":{${platforms.map((p) => `"${p}":{"caption":"","title":"","hashtags":[]}`).join(",")}}}`,
    thinking: "baixo",
    temperature: 0.8,
  };
}

// ── Contexto compartilhado ───────────────────────────────────────────────
export interface VideoFacts {
  objective: Objective | null;
  platforms: Platform[];
  durationS: number | null;
  resources: Resource[];
}

export function videoTag(v: VideoFacts): string {
  return tag("video", [
    line("Objetivo", v.objective),
    line("Plataformas", platformsLabel(v.platforms)),
    line("Duração", v.durationS ? durationLabel(v.durationS) : null),
    line("Recursos", v.resources.map((r) => (r === "com_alguem" ? "mais de uma pessoa" : RESOURCES[r].toLowerCase())).join(", ")),
    v.resources.length > 0 && !v.resources.some((r) => r === "sozinho" || r === "com_alguem") ? "Quantas pessoas aparecem: ainda não sabe. Prefira o que funciona com uma pessoa só." : null,
  ]);
}

// Quem aparece no vídeo. Sem isto, a IA inventa "A1" e "amiga" mesmo com os nomes já cadastrados.
export function castTag(creator: string | null | undefined, people: { name: string; role: string; roles?: string[] | null }[]): string {
  const me = people.find((p) => p.role === "eu")?.name.trim() || creator?.trim() || "";
  const guests = people.filter((p) => p.role !== "eu" && (p.role === "ator" || p.roles?.includes("ator"))).map((p) => p.name.trim()).filter(Boolean);
  if (!me && guests.length === 0) return "";
  return tag("pessoas", [
    line("Quem faz o vídeo e aparece", me),
    line("Também aparecem", guests.join(", ")),
    "Use estes nomes nas falas e nas ações. Sem nome para alguém da cena, use um papel fácil de entender.",
  ]);
}

export function productTag(objective: Objective | null, p: { product?: string | null; edge?: string | null }): string {
  if (objective !== "vender") return "";
  return tag("produto", [line("O que vende", p.product), line("Diferencial", p.edge)]);
}

export function personTag(p: { niche?: string | null; memory?: string[] }): string {
  const memory = (p.memory ?? []).map((m) => m.trim()).filter(Boolean);
  return tag("a_pessoa", [
    line("Nicho", p.niche),
    memory.length ? `O que já sabemos (use para personalizar; não repita estas frases):\n${memory.map((m) => `- ${m}`).join("\n")}` : null,
  ]);
}

// Formatos filtrados pelos recursos: quem grava sozinho não recebe os que precisam de outra pessoa.
export function formatsTag(resources: Resource[]): string {
  const solo = resources.includes("sozinho") && !resources.includes("com_alguem");
  return tag(
    "formatos",
    FORMATS.filter((f) => !(solo && f.needsSomeone)).map((f) => `${f.slug} ("${f.name}"): ${f.summary} Estrutura: ${f.structure.join(" → ")}.`),
  );
}

export function seenTag(titles: string[]): string {
  return tag("ja_viu", titles);
}

export function trendsTag(trends: { title: string; what: string }[]): string {
  return tag("tendencias", trends.map((t) => `${t.title}: ${t.what}`));
}

export function termsTag(): string {
  const terms = (name: string, t: Record<string, Term>) => `${name}: ${Object.entries(t).map(([k, v]) => `${k} (${v.label}: ${v.what})`).join("; ")}`;
  return tag("valores_permitidos", [terms("framing", FRAMINGS), terms("angle", ANGLES), terms("movement", MOVEMENTS), "orientation: vertical ou horizontal"]);
}

export { OBJECTIVES, PLATFORMS };
