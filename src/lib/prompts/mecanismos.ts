// Banco de mecanismos de humor: o "como funciona" de uma piada, com um exemplo forte e a versão fraca.
// Modelo de IA segue exemplo melhor do que segue regra, então cada pedido leva três cartões, escolhidos
// pelo assunto e revezados para a pessoa não receber sempre os mesmos. Fica só por dentro: nada disso aparece na tela.
// Os exemplos são inventados para o Gravaí; a IA é instruída a usar o mecanismo, nunca a cena.

export interface Mechanism {
  id: string;
  name: string;
  how: string;
  strong: string;
  weak: string;
  tags: string[]; // palavras do nicho ou do pedido que puxam este cartão
}

export const MECHANISMS: Mechanism[] = [
  {
    id: "escalada",
    name: "Escalada",
    how: "A mesma ação se repete em lugares ou momentos diferentes, e cada vez é mais exagerada. A última é a maior de todas.",
    strong: "Ela confere se trancou a porta ao sair. Depois volta do elevador para conferir. Depois, já no ônibus, liga para a vizinha conferir. No fim, pede foto da maçaneta.",
    weak: "Ela fica insegura e confere a porta várias vezes. (Não diz onde nem como: não tem o que filmar.)",
    tags: ["rotina", "mania", "esquec", "ansi", "casa", "repet"],
  },
  {
    id: "quebra",
    name: "Quebra de expectativa",
    how: "Monte em poucos segundos o caminho que todo mundo espera e entregue outro, que faça sentido assim que acontece.",
    strong: "Ela arruma a mesa, acende a vela, abre o caderno novo e põe a playlist \"foco total\". Corta para 40 minutos depois: ela ainda está escolhendo a playlist.",
    weak: "Ela tenta ser produtiva, mas algo inesperado acontece. (Não diz o que acontece.)",
    tags: ["produtiv", "plano", "dieta", "treino", "estud", "trabalh"],
  },
  {
    id: "dentro-fora",
    name: "Por dentro e por fora",
    how: "O que a pessoa diz em voz alta contra o que ela pensa. A graça está na distância entre os dois.",
    strong: "A amiga mostra o corte de cabelo novo. Em voz alta: \"Amei, ficou a sua cara!\". Texto na tela, por dentro: \"é a cara do meu tio Jorge\".",
    weak: "Ela finge que gostou do cabelo da amiga. (Sem a fala e sem o pensamento, não há piada.)",
    tags: ["amig", "trabalh", "famil", "namor", "client", "chefe", "sogra"],
  },
  {
    id: "expectativa-realidade",
    name: "Expectativa e realidade",
    how: "Duas cenas iguais na forma: como a pessoa imagina e como é de verdade. Os mesmos objetos, nos dois lados.",
    strong: "Expectativa: marmitas coloridas empilhadas, etiqueta com o dia da semana. Realidade: quinta-feira, ela come a de segunda em pé, na frente da geladeira, com a etiqueta colada no cotovelo.",
    weak: "Expectativa: vida organizada. Realidade: bagunça. (Dois temas, nenhuma cena.)",
    tags: ["fitness", "dieta", "organiz", "viagem", "mae", "matern", "receita", "treino"],
  },
  {
    id: "exagero",
    name: "Exagero de coisa pequena",
    how: "Um incômodo minúsculo tratado com a seriedade de uma tragédia: música, pausa dramática e gesto grande para um problema bobo.",
    strong: "O pote de sorvete está no congelador. Ela abre devagar, de olhos fechados. É feijão. Ela encosta a testa na porta da geladeira e fica ali, em luto.",
    weak: "Ela fica muito triste porque não tem sorvete. (Sentimento sem gesto.)",
    tags: ["comida", "casa", "celular", "internet", "transito", "mercado", "fome"],
  },
  {
    id: "tipos",
    name: "Tipos de pessoa",
    how: "A mesma situação com três pessoas diferentes, uma frase ou um gesto para cada. A terceira é a mais absurda e é quem assiste que se reconhece.",
    strong: "Na fila do pão: a que já chega com o dinheiro trocado na mão; a que pergunta o preço de tudo e leva um pãozinho; a que deixa todo mundo passar na frente porque ainda está decidindo.",
    weak: "Tipos de pessoa na padaria: a apressada, a indecisa, a simpática. (Só os rótulos, sem o que cada uma faz.)",
    tags: ["academia", "escritorio", "escola", "mercado", "grupo", "client", "aluno", "professor"],
  },
  {
    id: "logica-propria",
    name: "Lógica própria levada a sério",
    how: "A personagem segue uma regra absurda como se fosse óbvia, e explica com toda a calma. Quanto mais séria a explicação, maior a graça.",
    strong: "Ela não joga fora a sacola cheia de sacolas. Explica para a câmera, séria: \"Essa aqui é a sacola de emergência. Essa é a sacola da sacola de emergência\".",
    weak: "Ela guarda muitas sacolas e acha normal. (Falta a explicação dela, que é a piada.)",
    tags: ["mae", "avo", "famil", "casa", "economi", "mania", "brasileir"],
  },
  {
    id: "reacao",
    name: "A cara de quem percebe",
    how: "A piada não é o que acontece, é a reação. Segure o rosto em silêncio por um segundo a mais do que seria confortável.",
    strong: "Ela manda o áudio reclamando do chefe. Olha a tela. Era o grupo da empresa. Close no rosto, parado, só os olhos mexem. Ela vira o celular para baixo e sai da sala.",
    weak: "Ela manda mensagem no grupo errado e entra em pânico. (Pânico não se filma; o que ela faz, sim.)",
    tags: ["trabalh", "grupo", "mensag", "vergonha", "celular", "famil", "encontro"],
  },
  {
    id: "narrador",
    name: "Narrador sério para coisa banal",
    how: "Voz de documentário, de locutor de futebol ou de jornal descrevendo uma cena do dia a dia. O contraste carrega o vídeo sozinho.",
    strong: "Voz de documentário: \"Aqui, em seu habitat natural, o adolescente escuta a mãe chamar para o almoço. Pela terceira vez. Ele não se move\".",
    weak: "Um narrador comenta a rotina de um jeito engraçado. (Não diz o que ele fala.)",
    tags: ["pet", "cachorro", "gato", "filho", "crianca", "rotina", "futebol", "sozinh"],
  },
  {
    id: "inversao",
    name: "Papéis trocados",
    how: "Quem costuma mandar obedece, ou a regra vale ao contrário. A situação é conhecida; só os lugares mudam.",
    strong: "A filha adulta espera a mãe na sala, de braços cruzados: \"Isso são horas? Com quem a senhora estava? Tia Neide é quem?\".",
    weak: "A filha trata a mãe como se fosse a mãe dela. (A ideia está certa, mas falta a fala.)",
    tags: ["mae", "pai", "filho", "chefe", "professor", "casal", "famil"],
  },
  {
    id: "detalhe",
    name: "O detalhe que todo mundo conhece",
    how: "Nenhuma virada: só um comportamento muito específico, mostrado sem comentário, que faz quem assiste dizer \"achei que só eu fazia isso\".",
    strong: "Ela digita uma mensagem longa, apaga tudo, digita \"kkk\" e envia. Depois fica olhando para os três pontinhos da outra pessoa.",
    weak: "Aquele momento em que você não sabe o que responder. (É um tema, não um gesto.)",
    tags: ["celular", "mensag", "namor", "amig", "ansi", "rede", "internet", "sozinh"],
  },
  {
    id: "promessa-quebrada",
    name: "A promessa que não dura",
    how: "A personagem anuncia uma decisão firme e a própria fala seguinte já desmente. O intervalo entre as duas é curto.",
    strong: "Ela olha para a câmera: \"A partir de hoje, zero açúcar\". Corta para ela mexendo o café: \"Mas adoçante de brigadeiro não conta\".",
    weak: "Ela promete parar com o açúcar, mas não consegue. (Sem as duas falas, não tem ritmo.)",
    tags: ["dieta", "fitness", "treino", "dinheiro", "economi", "estud", "segunda"],
  },
];

const plain = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Número estável a partir de um texto: o mesmo vídeo recebe os mesmos cartões, e vídeos diferentes, outros.
function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Três cartões: primeiro os que combinam com o assunto; no empate, reveza pelo vídeo.
export function pickMechanisms(seed: string, texts: (string | null | undefined)[], n = 3): Mechanism[] {
  const subject = plain(texts.filter(Boolean).join(" "));
  return MECHANISMS.map((m) => ({ m, score: m.tags.filter((t) => subject.includes(t)).length, order: hash(`${seed}:${m.id}`) }))
    .sort((a, b) => Math.min(b.score, 2) - Math.min(a.score, 2) || a.order - b.order)
    .slice(0, n)
    .map((x) => x.m);
}

export function mechanismsText(cards: Mechanism[]): string {
  return cards.map((c) => `- ${c.name}: ${c.how}\n  Forte: ${c.strong}\n  Fraco: ${c.weak}`).join("\n");
}
