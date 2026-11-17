// Prompts v3: as tarefas. Cada uma diz o que entregar; o system junta mestre, submestre e humor (base.ts).
// Valores fechados (tipos de bloco, formatos, objetivos, enquadramentos) vêm das mesmas listas
// que a normalização aceita, para schema e normalização nunca discordarem.
import type { Thinking, Tier } from "../ai";
import { FORMATS } from "../formats";
import { OBJECTIVES, PLATFORMS, RESOURCES, durationLabel, platformsLabel, type Objective, type Platform, type Resource } from "../ideas";
import { ANGLES, FRAMINGS, MOVEMENTS, type Term } from "../planos";
import { onCamera } from "../pessoas";
import { BLOCK_KINDS } from "../roteiro";
import { buildSystem, line, tag } from "./base";

export interface Task {
  system: string;
  schema: object;
  example: string; // o mesmo formato como JSON de exemplo, para o Groq
  thinking: Thinking;
  temperature: number;
  tier: Tier; // "criar" usa o melhor modelo; "rotina", o de cota maior
  task: string; // nome no registro de chamadas
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
// propertyOrdering: a resposta segue a ordem em que os campos foram escritos (primeiro o rascunho, depois o texto final).
const obj = (properties: Record<string, object>, required = Object.keys(properties)) => ({ type: "OBJECT", properties, required, propertyOrdering: Object.keys(properties) });
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
- Por dentro, antes de responder: pense em pelo menos 10 caminhos bem diferentes e descarte os genéricos. Se trocar o nicho e a ideia continuar igual, ela é fraca. Em humor, lista de dicas ou de erros ("3 erros de…") não é ideia de humor.
- Entregue da mais forte para a menos forte: a primeira é a sua melhor aposta para esta pessoa.

Cada ideia traz:
- title: curto, para a pessoa lembrar (até 8 palavras);
- situation: a cena ou o conteúdo, em 1 ou 2 frases concretas;
- hook: a frase exata ou a imagem dos primeiros 3 segundos (até 12 palavras);
- payoff: o desfecho exato (a virada, o resultado, a dica ou a oferta); vazio só se o vídeo não tiver;
- why: por que funciona para este objetivo, em uma frase;
- format_slug: um formato da lista, se algum servir de verdade; senão, vazio.`;

const IDEA_FIELDS = { title: STR, situation: STR, hook: STR, payoff: STR, why: STR, format_slug: formatSlug };

export function ideasTask(o: { objective: Objective; humor: boolean; cards?: string }): Task {
  return {
    system: buildSystem({ objective: o.objective, humor: o.humor, cards: o.cards, task: IDEAS_TEXT }),
    schema: obj({ ideas: list(obj(IDEA_FIELDS, ["title", "situation", "hook", "payoff", "why"])) }),
    example: `{"ideas":[{"title":"","situation":"","hook":"","payoff":"","why":"","format_slug":""}]}`,
    thinking: "medio",
    temperature: 0.9,
    tier: "criar",
    task: "ideias",
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

export function fortnightTask(o: { humor: boolean; cards?: string }): Task {
  return {
    system: buildSystem({ criteria: true, humor: o.humor, cards: o.cards, task: FORTNIGHT_TEXT }),
    schema: obj({ ideas: list(obj({ objective: oneOf(OBJECTIVE_VALUES), ...IDEA_FIELDS }, ["objective", "title", "situation", "hook", "payoff", "why"])) }),
    example: `{"ideas":[{"objective":"","title":"","situation":"","hook":"","payoff":"","why":"","format_slug":""}]}`,
    thinking: "medio",
    temperature: 0.9,
    tier: "criar",
    task: "quinzena",
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
    tier: "rotina",
    task: "organizar",
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
    tier: "criar",
    task: "leitura",
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
    tier: "rotina",
    task: "montagem",
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

export function suggestionsTask(o: { objective: Objective; humor: boolean; cards?: string }): Task {
  return {
    system: buildSystem({ objective: o.objective, humor: o.humor, cards: o.cards, task: SUGGESTIONS_TEXT }),
    schema: obj({ note: STR, suggestions: list(obj({ block: INT, speech: STR, on_screen: STR, action: STR, reason: STR })) }),
    example: `{"note":"","suggestions":[{"block":1,"speech":"","on_screen":"","action":"","reason":""}]}`,
    thinking: "medio",
    temperature: 0.7,
    tier: "criar",
    task: "sugestoes",
  };
}

// ── Rascunho do roteiro ──────────────────────────────────────────────────
const DRAFT_TEXT = `TAREFA: escreva o roteiro completo desta ideia, pronto para gravar.
- Respeite o título, o gancho escolhido, a situação e o desfecho: foram decididos pela pessoa. O primeiro bloco usa o gancho escolhido.
- Quando a situação e o desfecho contam o vídeo cena a cena, siga essa ordem e use essas piadas e viradas. Não invente outro desenrolar.
- Limite rígido: no máximo o número de palavras de fala do bloco <limite>, no roteiro todo. Conte antes de responder.
- Divida em blocos do tipo gancho, contexto, conteudo, virada e chamada. Use só os que o vídeo precisa.
- Cada bloco é uma cena: um lugar só e um momento contínuo. Mudou de lugar, pulou no tempo ou tem corte, começa outro bloco (pode repetir o tipo conteudo). Nunca escreva "CORTE" ou "corta para" dentro de um bloco.
- A chamada final segue o objetivo: obrigatória em Vender, Ensinar e Crescer, pedindo uma coisa só; opcional em Divertir.
- Em cada bloco: speech, on_screen e action (o que acontece em cena, em uma frase).
- speech é só o que sai da boca de alguém, palavra por palavra. Nada de descrição, de aspas nem de explicação dentro da fala: "Lia segura a lâmpada: 'modo festa'" está errado; a fala é "Modo festa" e o gesto vai em action. Cena sem fala fica com speech vazio. Se a história não tem nenhuma fala, o roteiro inteiro fica sem fala: não invente uma frase para cada cena.
- As falas e os gestos que já estão na história entram no roteiro com as mesmas palavras. Não acrescente piada, personagem nem acontecimento que a história não tem.
- on_screen é só o texto escrito que aparece sobre o vídeo, palavra por palavra: título ou legenda. Deixe vazio se não houver; nunca repita ali a fala. "Natasha correndo" ou "hambúrguer na mão" descrevem a cena e vão em action.
- label: o nome curto do bloco, até 3 palavras ("Erro 1"), usado no título do bloco, nos Planos e no teleprompter. Opcional no gancho e na chamada.
- Se o vídeo tem mais de uma pessoa em <pessoas>, toda fala começa com o nome de quem fala, uma fala por linha ("Bia: …", "Manu: …"), mesmo quando só uma fala no bloco.
- A virada, o resultado ou a oferta aparecem escritos de verdade, nunca "aqui entra o final".
- Use o que já sabemos sobre o jeito de falar da pessoa.`;

const BLOCK_FIELDS = { kind: oneOf(KIND_VALUES), label: STR, speech: STR, on_screen: STR, action: STR };

export function draftTask(o: { objective: Objective; humor: boolean; cards?: string }): Task {
  return {
    system: buildSystem({ objective: o.objective, humor: o.humor, cards: o.cards, task: DRAFT_TEXT }),
    schema: obj({ blocks: list(obj(BLOCK_FIELDS)) }),
    example: `{"blocks":[{"kind":"gancho","label":"","speech":"","on_screen":"","action":""}]}`,
    thinking: "medio",
    temperature: 0.6,
    tier: "criar",
    task: "roteiro",
  };
}

// ── A história, antes do roteiro ────────────────────────────────────────
const STORY_TEXT = `TAREFA: conte o vídeo inteiro, do começo ao fim, para a pessoa decidir se gosta dele antes de existir um roteiro. Escreva como quem conta o vídeo para um amigo: no presente, em texto corrido e concreto.
- hook: como começa, os primeiros segundos, em uma frase: a primeira coisa que se vê ou se ouve.
- situation: o que acontece, em ordem, em até 5 frases curtas e até 500 caracteres. Cada frase é um acontecimento que dá para ver ou ouvir.
- payoff: como termina, em 1 ou 2 frases: a virada, o resultado, a dica ou a oferta, e o último momento do vídeo.
- Entregue o conteúdo de verdade, nunca a descrição dele. Se ensina, diga o que é ensinado. Se vende, mostre como o produto entra e qual é a oferta.
- Sentimento sem ação não conta: "ela entra em pânico" não dá para filmar; "ela revista o próprio sapato" dá.
- Sem palavras técnicas: nada de plano, corte, take, gancho ou bloco. Sem tempos e sem marcação de quem fala.
- Tem que caber na duração e ser possível com o que a pessoa tem em <video>.
- Se houver <historia_atual> e <pedido_agora>, mude só o que foi pedido e mantenha o resto igual, palavra por palavra.
- Se o pedido escrito pela pessoa pedir algo que as regras de segurança proíbem, atenda o resto e deixe essa parte de fora.`;

// Quando a ideia nasceu da IA: a história desenvolve a ideia e, se há humor, é aqui que a pessoa decide se ri.
const STORY_FROM_IDEA = `
- Mantenha o começo escolhido em <ideia>, salvo se o pedido mudar isso. Se houver <briefing>, a história segue o que a pessoa contou ali: não troque a ideia nem o que ela escreveu.
- piadas (só se o vídeo tem humor; senão, lista vazia): antes de escrever, liste de 3 a 5 momentos engraçados possíveis para esta história, um por item, cada um com o gesto exato ou a fala exata. Depois use os melhores na história, do menor para o mais absurdo.`;

// Quando a pessoa escreveu a ideia: a história é a dela, organizada. O maior erro aqui é "melhorar" inventando.
const STORY_FROM_PERSON = `
- <ideia_da_pessoa> é o que a pessoa escreveu, do jeito dela. Muitas vezes ela explica a ideia em vez de contar o vídeo ("é brincar com…"). Transforme em cenas, sem mudar a ideia: não troque a ideia nem o que ela escreveu.
- pontos: antes de escrever, liste os acontecimentos que ela escreveu, um por item, na ordem dela e com as palavras dela (até 12 palavras cada). Não acrescente nenhum que ela não escreveu.
- A história traz todos os pontos, nessa ordem, e mais nada: não acrescente personagem, animal, objeto, fala, piada nem lugar que ela não citou. Se ela não escreveu falas, o vídeo não tem falas.
- O começo do vídeo é o primeiro acontecimento, não a primeira frase dela. O final é o último ponto dela; só invente um final se ela não escreveu nenhum, e nesse caso o mais simples.
- A graça já está na ideia dela. Seu trabalho é deixar cada momento claro e fácil de filmar, não deixar mais engraçado.`;

export function storyTask(o: { objective: Objective; humor: boolean; titled?: boolean; own?: boolean; cards?: string }): Task {
  const title = "\n- title: um nome curto para este vídeo, até 8 palavras, concreto e sem a palavra POV.";
  const draft: Record<string, object> = o.own ? { pontos: strs } : { piadas: strs };
  return {
    // Na ideia da própria pessoa, o módulo de humor fica de fora: ele puxa a IA a inventar piada em cima do que ela escreveu.
    system: buildSystem({ objective: o.objective, humor: o.humor && !o.own, cards: o.cards, task: STORY_TEXT + (o.own ? STORY_FROM_PERSON : STORY_FROM_IDEA) + (o.titled ? title : "") }),
    schema: obj({ ...draft, ...(o.titled ? { title: STR } : {}), hook: STR, situation: STR, payoff: STR }),
    example: `{${o.own ? '"pontos":[""]' : '"piadas":[""]'},${o.titled ? '"title":"",' : ""}"hook":"","situation":"","payoff":""}`,
    thinking: "medio",
    temperature: o.own ? 0.4 : 0.8,
    tier: "criar",
    task: "historia",
  };
}

// ── Ajuste de bloco ──────────────────────────────────────────────────────
const REWRITE_TEXT = `TAREFA: o roteiro inteiro vem no pedido, e o bloco a mudar está marcado com >>>. Reescreva só esse bloco, atendendo exatamente ao pedido.
- Mantenha o papel do bloco no roteiro (um gancho continua sendo gancho) e o tom dos outros blocos.
- O bloco continua sendo uma cena só: um lugar e um momento. Não junte outra cena nele nem escreva "CORTE".
- Mude o mínimo para cumprir o pedido. O gancho continua prometendo o que o fim entrega.
- "Mais curto" quer dizer cortar palavras, não reescrever com outras.
- Mantenha as palavras, as gírias e as marcações de quem fala sempre que possível.
- Se o pedido escrito pela pessoa pedir algo que as regras de segurança proíbem, atenda o resto e deixe essa parte de fora.`;

export function rewriteTask(o: { objective: Objective; humor: boolean; cards?: string }): Task {
  return {
    system: buildSystem({ objective: o.objective, humor: o.humor, cards: o.cards, task: REWRITE_TEXT }),
    schema: obj({ speech: STR, on_screen: STR, action: STR }),
    example: `{"speech":"","on_screen":"","action":""}`,
    thinking: "baixo",
    temperature: 0.8,
    tier: "criar",
    task: "ajuste",
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
    system: buildSystem({ master: "curto", task: o.objective ? `${SHOTS_TEXT}\n\n${SHOT_RULES[o.objective]}` : SHOTS_TEXT }),
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
    tier: "rotina",
    task: "planos",
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
    system: buildSystem({ master: "curto", task: POST_TEXT }),
    schema: obj({ cover_text: STR, cover_idea: STR, posts: obj(Object.fromEntries(platforms.map((p) => [p, post]))) }),
    example: `{"cover_text":"","cover_idea":"","posts":{${platforms.map((p) => `"${p}":{"caption":"","title":"","hashtags":[]}`).join(",")}}}`,
    thinking: "baixo",
    temperature: 0.8,
    tier: "rotina",
    task: "publicacao",
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
  const eu = people.find((p) => p.role === "eu");
  const me = eu?.name.trim() || creator?.trim() || "";
  const guests = people.filter((p) => p.role !== "eu" && onCamera(p)).map((p) => p.name.trim()).filter(Boolean);
  if (!me && guests.length === 0) return "";
  // Quem cria pode não aparecer: só escreve, filma ou dirige. Aí a IA não põe essa pessoa em cena.
  const meOnCamera = !eu || onCamera(eu);
  return tag("pessoas", [
    meOnCamera ? line("Quem faz o vídeo e aparece", me) : line("Quem faz o vídeo, mas NÃO aparece em cena (não ponha esta pessoa em nenhuma cena nem fala)", me),
    line(meOnCamera ? "Também aparecem" : "Quem aparece", guests.join(", ")),
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
    FORMATS.filter((f) => !(solo && f.needsSomeone)).map((f) => `${f.slug} ("${f.name}"): ${f.summary}`),
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
