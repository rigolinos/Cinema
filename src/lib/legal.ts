// Documentos legais do Gravaí. Texto-base: precisa de revisão jurídica antes do lançamento público.
// Mudou o texto? Suba a versão em LEGAL_VERSIONS: quem já tem conta aceita de novo na próxima entrada.

export const COMPANY = {
  product: "Gravaí",
  cnpj: "67.241.293/0001-70",
  owner: "Rodrigo Rigo",
  email: "rootcode@gmail.com",
  site: "https://cinema-theta-silk.vercel.app",
};

export type LegalDocument = "termos" | "privacidade";

export const LEGAL_VERSIONS: Record<LegalDocument, string> = {
  termos: "v1",
  privacidade: "v1",
};

export const LEGAL_UPDATED_AT = "21 de outubro de 2026";

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

const who = `o ${COMPANY.product}, mantido pela empresa inscrita no CNPJ ${COMPANY.cnpj}, de ${COMPANY.owner}`;

export const TERMS: LegalSection[] = [
  {
    title: "1. O que é o Gravaí",
    paragraphs: [
      `Estes Termos regem o uso do ${COMPANY.product}, um aplicativo que ajuda a criar vídeos: ideias, roteiro, planos de gravação, organização do dia de gravação e texto de publicação. O serviço é oferecido por ${who}.`,
      "O Gravaí está em fase de testes. Funções podem mudar, ficar fora do ar ou ser retiradas sem aviso.",
    ],
  },
  {
    title: "2. Sua conta",
    paragraphs: [
      "Para usar o Gravaí você cria uma conta com nome, e-mail e senha. Você é responsável por manter a senha em segredo e pelo que for feito na sua conta.",
      "Você pode excluir sua conta quando quiser, pelo Perfil, em Privacidade e dados.",
    ],
  },
  {
    title: "3. O seu conteúdo é seu",
    paragraphs: [
      "Ideias, roteiros, planos e textos que você cria ou edita no Gravaí são seus. Você nos autoriza a guardar e processar esse conteúdo apenas para fazer o serviço funcionar para você.",
      "Não usamos o seu conteúdo para divulgação nem o vendemos.",
    ],
  },
  {
    title: "4. Sugestões feitas por inteligência artificial",
    paragraphs: [
      "Parte das sugestões (ideias, roteiro, planos, legenda) é gerada por inteligência artificial. Elas podem conter erros, repetir ideias comuns ou não servir ao seu caso. Revise antes de usar.",
      "Quem publica o vídeo é você. Você é responsável pelo que publica, incluindo músicas, marcas, imagens de outras pessoas e o cumprimento das regras de cada plataforma.",
    ],
  },
  {
    title: "5. Pessoas que aparecem no seu vídeo",
    paragraphs: [
      "Ao convidar alguém pelo link do Gravaí, você se compromete a usar os dados dessa pessoa só para organizar a gravação. A autorização de uso de imagem registrada no app é um apoio: a responsabilidade de obter as autorizações necessárias, inclusive de responsáveis por menores de idade, é sua.",
    ],
  },
  {
    title: "6. O que não é permitido",
    paragraphs: [
      "Usar o Gravaí para criar conteúdo ilegal, que incite violência ou discriminação, que viole direitos de terceiros, que envolva exploração de menores ou para tentar burlar a segurança do serviço. Podemos suspender contas que façam isso.",
    ],
  },
  {
    title: "7. Limites e responsabilidade",
    paragraphs: [
      "O Gravaí é oferecido no estado em que se encontra, durante a fase de testes e sem cobrança. Não garantimos resultados (alcance, vendas, seguidores) com os vídeos criados.",
      "Há um limite diário de uso das funções de inteligência artificial por pessoa.",
    ],
  },
  {
    title: "8. Mudanças nestes Termos",
    paragraphs: [
      "Se os Termos mudarem, avisamos no próprio app e pedimos um novo aceite antes de você continuar.",
    ],
  },
  {
    title: "9. Contato e foro",
    paragraphs: [
      `Dúvidas: ${COMPANY.email}. Estes Termos seguem a lei brasileira. Fica eleito o foro do domicílio do usuário para resolver qualquer questão.`,
    ],
  },
];

export const PRIVACY: LegalSection[] = [
  {
    title: "1. Quem cuida dos seus dados",
    paragraphs: [
      `O controlador dos dados é ${who}. Para qualquer assunto de privacidade, inclusive pedidos sobre os seus dados, escreva para ${COMPANY.email}.`,
    ],
  },
  {
    title: "2. Que dados tratamos",
    paragraphs: [
      "Conta: nome, e-mail e senha (guardada de forma cifrada pelo nosso provedor de autenticação).",
      "Perfil de criador: nome de exibição, nicho e plataformas em que você publica.",
      "Conteúdo: ideias, roteiros, planos, data e lugar da gravação e textos de publicação que você cria no app.",
      "Pessoas convidadas: nome que você informa, confirmação de presença e, quando dada, a autorização de uso de imagem (nome completo, data e versão do termo). Não pedimos telefone nem e-mail dos convidados.",
      "Uso: quantas vezes por dia você usou as funções de inteligência artificial e registros técnicos de acesso mantidos pelos nossos provedores.",
    ],
  },
  {
    title: "3. Para que usamos e com que base legal",
    paragraphs: [
      "Para prestar o serviço que você pediu (criar, guardar e organizar seus vídeos): execução de contrato (LGPD, art. 7º, V).",
      "Para manter o serviço seguro, limitar abusos e corrigir erros: legítimo interesse (art. 7º, IX).",
      "Para guardar a prova dos aceites dos Termos, desta Política e das autorizações de imagem: cumprimento de obrigação legal e exercício regular de direitos (art. 7º, II e VI).",
    ],
  },
  {
    title: "4. Com quem compartilhamos",
    paragraphs: [
      "Supabase (banco de dados e login) e Vercel (hospedagem do app): guardam e entregam o serviço.",
      "Google (Gemini) e Groq (inteligência artificial): recebem o que é necessário para gerar sugestões, como seu nicho, a ideia, o roteiro e a lista de planos. Não enviamos seu e-mail nem dados de contato. Atenção: nesta fase de testes usamos o plano gratuito do Google Gemini, no qual o Google pode usar o conteúdo recebido para melhorar os próprios serviços. Por isso, não coloque dados pessoais sensíveis nos textos.",
      "Não vendemos seus dados e não os usamos para publicidade.",
    ],
  },
  {
    title: "5. Transferência para fora do Brasil",
    paragraphs: [
      "Esses provedores guardam e processam dados em servidores nos Estados Unidos. A transferência é feita para executar o serviço que você contratou (LGPD, art. 33, IX) e com provedores que adotam medidas de segurança reconhecidas no mercado.",
    ],
  },
  {
    title: "6. Por quanto tempo guardamos",
    paragraphs: [
      "Enquanto sua conta existir. Ao excluir a conta, apagamos seus dados e seu conteúdo, inclusive as pessoas convidadas e as autorizações de imagem que você recebeu, ressalvados registros técnicos que os provedores mantêm por prazo limitado por segurança.",
    ],
  },
  {
    title: "7. Seus direitos",
    paragraphs: [
      "Você pode, a qualquer momento: confirmar se tratamos seus dados e acessá-los; corrigi-los; pedir a exclusão; receber uma cópia (portabilidade); saber com quem compartilhamos; e revogar consentimentos (LGPD, art. 18).",
      `No app: Perfil › Privacidade e dados, com "Baixar meus dados" e "Excluir minha conta". Por e-mail: ${COMPANY.email}. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).`,
    ],
  },
  {
    title: "8. Segurança",
    paragraphs: [
      "Cada pessoa só acessa o que é dela, por regras no próprio banco de dados. Links de convidados usam um código secreto e podem ser desligados a qualquer momento. Se houver um incidente que possa causar risco ou dano relevante, avisaremos você e a ANPD.",
    ],
  },
  {
    title: "9. Cookies",
    paragraphs: [
      "Usamos apenas os cookies necessários para manter você logado. Não usamos cookies de publicidade nem de rastreamento.",
    ],
  },
  {
    title: "10. Mudanças nesta Política",
    paragraphs: ["Se esta Política mudar, avisamos no app e pedimos um novo aceite antes de você continuar."],
  },
];

// Documentos que a pessoa ainda precisa aceitar na versão atual.
export function pendingDocuments(accepted: { document: string; version: string }[]): LegalDocument[] {
  return (Object.keys(LEGAL_VERSIONS) as LegalDocument[]).filter(
    (doc) => !accepted.some((a) => a.document === doc && a.version === LEGAL_VERSIONS[doc]),
  );
}
