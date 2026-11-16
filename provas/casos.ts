// Banco de provas: pedidos fictícios, sempre os mesmos, tirados dos tipos de problema que apareceram nos testes.
// Não coloque aqui dado de ninguém de verdade: isto vai para os fornecedores de IA.
import type { Objective, Platform, Resource } from "../src/lib/ideas";

export interface ProvaCase {
  id: string;
  objective: Objective;
  niche: string;
  platforms: Platform[];
  durationS: number;
  resources: Resource[];
  // A pessoa escreveu a própria ideia ("Já tenho a ideia"): a história parte deste texto, sem passar pelas ideias.
  ownIdea?: string;
  // O que tem de aparecer na história. Cada item aceita alternativas separadas por "|".
  mustKeep?: string[];
  cast?: { me: string; guests: string[] };
  product?: string;
  edge?: string;
  memory?: string[];
}

export const CASES: ProvaCase[] = [
  {
    // A pessoa escreve a ideia com os lugares em ordem. A IA costuma trocar ou esquecer algum.
    id: "alarme-do-carro",
    objective: "divertir",
    niche: "Humor",
    platforms: ["reels", "tiktok", "shorts"],
    durationS: 30,
    resources: ["sozinho", "em_casa", "na_rua"],
    cast: { me: "Lia Prado", guests: [] },
    ownIdea:
      "É brincar com uma situação comum, que é travar o carro com o controle e 10 segundos depois esquecer se travou. Eu vou mudando de lugar e apertando o botão do controle: primeiro na frente do carro, depois na esquina, depois saindo da porta de casa, depois apareço na janela apertando, e por último já indo dormir.",
    mustKeep: ["carro", "esquina", "porta", "janela", "dormir|cama|deita"],
  },
  {
    // Do zero, humor, sozinha: o caso mais comum. Mede se a ideia e a história trazem a piada escrita.
    id: "humor-do-zero",
    objective: "divertir",
    niche: "Humor",
    platforms: ["reels"],
    durationS: 30,
    resources: ["sozinho", "em_casa"],
    cast: { me: "Lia Prado", guests: [] },
  },
  {
    // Duas pessoas: as duas precisam aparecer pelo nome e ter fala.
    id: "dupla-na-corrida",
    objective: "divertir",
    niche: "Humor sobre vida fitness de mentira",
    platforms: ["reels"],
    durationS: 30,
    resources: ["com_alguem", "na_rua"],
    cast: { me: "Lia Prado", guests: ["Duda"] },
    ownIdea:
      "A Duda me encontra correndo na rua e elogia: nossa, que focada, super fitness. Aí vêm lembranças minhas comendo sorvete direto do pote, salgadinho no sofá e hambúrguer. Volta para o presente e eu só respondo obrigada, com um sorriso amarelo.",
    mustKeep: ["Duda", "sorvete", "salgadinho", "hamb", "obrigada"],
  },
  {
    // Vender, para o trabalho de humor não piorar os outros objetivos.
    id: "bolo-de-pote",
    objective: "vender",
    niche: "Doces artesanais",
    platforms: ["reels"],
    durationS: 30,
    resources: ["sozinho", "em_casa"],
    cast: { me: "Lia Prado", guests: [] },
    product: "Bolo de pote",
    edge: "Feito no dia da entrega, sem conservante",
  },
  {
    id: "pao-sem-maquina",
    objective: "ensinar",
    niche: "Pão caseiro sem máquina",
    platforms: ["shorts"],
    durationS: 60,
    resources: ["sozinho", "em_casa"],
    cast: { me: "Lia Prado", guests: [] },
  },
];
