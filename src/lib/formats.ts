// Biblioteca de formatos: estruturas de vídeo curto que funcionam em quase todo nicho.
// O assistente usa esta lista para sugerir ideias, e a tela Ideias mostra para a pessoa.

export interface VideoFormat {
  slug: string;
  name: string;
  summary: string; // o que é, em uma frase
  structure: string[]; // a ordem dos blocos
  hookExample: string;
  why: string; // por que prende quem assiste
  idealSeconds: [number, number];
  needsSomeone: boolean; // precisa de outra pessoa em cena ou filmando
}

export const FORMATS: VideoFormat[] = [
  {
    slug: "tres-erros",
    name: "3 erros que…",
    summary: "Uma lista curta de erros comuns do seu nicho, com o jeito certo de fazer.",
    structure: ["Gancho com a promessa", "Erro 1 e a correção", "Erro 2 e a correção", "Erro 3 e a correção", "Chamada final"],
    hookExample: "Você está perdendo metade do resultado por causa disso.",
    why: "Quem assiste quer saber se comete o erro, e fica até o terceiro.",
    idealSeconds: [20, 45],
    needsSomeone: false,
  },
  {
    slug: "antes-depois",
    name: "Antes e depois",
    summary: "Mostra o resultado primeiro e o processo depois.",
    structure: ["O depois, já no primeiro segundo", "O antes", "Os passos do processo", "O depois de novo", "Chamada final"],
    hookExample: "Isso aqui era assim há 30 dias.",
    why: "O contraste prende o olho e cria a pergunta: como chegou lá?",
    idealSeconds: [15, 40],
    needsSomeone: false,
  },
  {
    slug: "pov",
    name: "POV",
    summary: "Uma situação do ponto de vista de quem vive, quase sempre com humor.",
    structure: ["Texto na tela com a situação", "A reação ou a cena", "A virada", "Final rápido"],
    hookExample: "POV: é seu primeiro dia e ninguém te explicou nada.",
    why: "A pessoa se reconhece na situação e quer mandar para alguém.",
    idealSeconds: [7, 25],
    needsSomeone: false,
  },
  {
    slug: "tutorial-rapido",
    name: "Tutorial rápido",
    summary: "Ensina uma coisa só, do começo ao fim, sem enrolar.",
    structure: ["Gancho com o resultado", "Passo 1", "Passo 2", "Passo 3", "Resultado e chamada final"],
    hookExample: "Em 30 segundos você aprende a fazer isso.",
    why: "Entrega valor rápido, e quem aprende salva o vídeo para depois.",
    idealSeconds: [20, 60],
    needsSomeone: false,
  },
  {
    slug: "storytime",
    name: "Storytime",
    summary: "Você conta uma história real, com começo, tensão e desfecho.",
    structure: ["Gancho com o momento mais forte", "Contexto rápido", "O problema", "A virada", "O desfecho e a lição"],
    hookExample: "Eu quase desisti de tudo por causa de uma mensagem.",
    why: "Histórias seguram a atenção: a pessoa quer saber como termina.",
    idealSeconds: [30, 90],
    needsSomeone: false,
  },
  {
    slug: "bastidores",
    name: "Bastidores",
    summary: "Mostra como algo é feito por dentro: seu trabalho, sua rotina, seu processo.",
    structure: ["Gancho com algo curioso", "Etapas do processo", "Um detalhe que ninguém vê", "Resultado final"],
    hookExample: "Ninguém imagina o que acontece antes disso chegar até você.",
    why: "Curiosidade e proximidade: a pessoa sente que conhece você.",
    idealSeconds: [20, 60],
    needsSomeone: false,
  },
  {
    slug: "mito-verdade",
    name: "Mito ou verdade",
    summary: "Desmente uma crença comum do nicho, com explicação curta.",
    structure: ["A crença na tela", "Mito ou verdade?", "A explicação", "O que fazer no lugar", "Chamada final"],
    hookExample: "Todo mundo acha que isso funciona. Não funciona.",
    why: "Contrariar o que a pessoa acredita desperta vontade de comentar.",
    idealSeconds: [15, 40],
    needsSomeone: false,
  },
  {
    slug: "reacao",
    name: "Reação",
    summary: "Você reage a algo do seu nicho e dá a sua opinião de quem entende.",
    structure: ["Mostra o que vai reagir", "Primeira reação", "Sua análise", "Opinião final"],
    hookExample: "Vi isso e precisei comentar.",
    why: "Aproveita um assunto que já chama atenção e mostra sua autoridade.",
    idealSeconds: [20, 60],
    needsSomeone: false,
  },
  {
    slug: "desafio",
    name: "Desafio",
    summary: "Você se propõe um desafio e mostra se consegue.",
    structure: ["O desafio na tela", "As regras", "A tentativa", "O resultado"],
    hookExample: "Tentei fazer isso em 1 minuto. Olha o que aconteceu.",
    why: "Cria expectativa: quem assiste quer ver se deu certo.",
    idealSeconds: [15, 60],
    needsSomeone: false,
  },
  {
    slug: "dialogo",
    name: "Diálogo encenado",
    summary: "Uma conversa curta entre dois personagens, que você ou um amigo interpretam.",
    structure: ["Fala de abertura forte", "Troca de falas", "A virada", "Fala final"],
    hookExample: "— Você vai mesmo fazer isso? — Vou.",
    why: "Personagens e conflito prendem como uma cena de série.",
    idealSeconds: [15, 45],
    needsSomeone: true,
  },
];

export function findFormat(slug: string | null | undefined): VideoFormat | undefined {
  return FORMATS.find((f) => f.slug === slug);
}
