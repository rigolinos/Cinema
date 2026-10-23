import { ANGLES, FRAMINGS, MOVEMENTS, SET_RULES, type Term } from "@/lib/planos";
import { POST_PARTS } from "@/lib/publicar";

// Âncora de cada termo, para o "Saber mais" das telas cair direto nele.
function termId(term: string): string {
  return term
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Aprenda: os termos que aparecem no caminho, explicados em uma linha e com o porquê.
// Enquadramentos, ângulos e movimentos vêm do mesmo vocabulário da tela de planos.
const TERMS = [
  {
    term: "Gancho",
    what: "O que você fala ou mostra nos 3 primeiros segundos.",
    why: "É ali que a pessoa decide se continua assistindo ou rola o feed.",
  },
  {
    term: "Formato",
    what: "A estrutura do vídeo: a ordem em que as coisas acontecem.",
    why: "Um formato que já funciona deixa você focar no assunto, não na forma.",
  },
  {
    term: "Contexto",
    what: "Uma ou duas frases que situam quem assiste: de que situação você está falando.",
    why: "Sem contexto, a pessoa não entende por que deveria se importar.",
  },
  {
    term: "Virada",
    what: "A surpresa, o resultado ou a lição que fecha a ideia.",
    why: "É o momento que faz a pessoa comentar, mandar para alguém ou assistir de novo.",
  },
  {
    term: "Chamada final",
    what: "O pedido no fim do vídeo: seguir, comentar, salvar, comprar.",
    why: "Quem gostou precisa saber o que fazer em seguida. Peça uma coisa só.",
  },
  {
    term: "Retenção",
    what: "Quanto do vídeo as pessoas assistem antes de sair.",
    why: "As plataformas mostram mais o vídeo que segura as pessoas até o fim. Gancho forte e vídeo sem enrolação ajudam.",
  },
  {
    term: "Roteiro",
    what: "O texto do vídeo dividido em partes: o que você fala, o que aparece escrito e o que acontece em cena.",
    why: "Com roteiro você grava mais rápido e não esquece o que ia dizer.",
  },
  {
    term: "Dividir em planos",
    what: "Separar cada parte do roteiro nas tomadas que você vai gravar. No cinema, isso se chama decupagem.",
    why: "Fazer isso antes evita descobrir na edição que faltou um take.",
  },
  {
    term: "Ordem de gravação",
    what: "Gravar juntos os planos do mesmo lugar e da mesma roupa, mesmo que fiquem longe no roteiro.",
    why: "Você troca menos de cenário e de roupa. Na edição, cada plano volta para o lugar dele.",
  },
  {
    term: "Plano",
    what: "Cada pedaço que você grava sem cortar.",
    why: "Variar os planos (perto, longe, de lado) deixa o vídeo mais vivo.",
  },
  {
    term: "Take",
    what: "Cada tentativa de gravar o mesmo plano.",
    why: "Grave dois ou três takes do que é importante: na edição você escolhe o melhor.",
  },
];

function Section({ id, title, intro, terms }: { id: string; title: string; intro?: string; terms: { term: string; what: string; why: string }[] }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="flex scroll-mt-6 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-titulo`} className="label-set">
          {title}
        </h2>
        {intro && <p className="text-sm leading-relaxed text-muted-foreground">{intro}</p>}
      </div>
      <dl className="flex flex-col gap-3">
        {terms.map((t) => (
          <div key={t.term} id={termId(t.term)} className="flex scroll-mt-6 flex-col gap-1.5 rounded-2xl bg-card p-4">
            <dt className="text-lg font-bold">{t.term}</dt>
            <dd className="text-[15px] leading-relaxed">{t.what}</dd>
            <dd className="text-sm leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">Por quê:</strong> {t.why}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const asTerms = (terms: Record<string, Term>) => Object.values(terms).map((t) => ({ term: t.label, what: t.what, why: t.why }));

const SECTIONS = [
  { id: "basico", title: "O básico", terms: TERMS },
  { id: "enquadramentos", title: "Enquadramentos", intro: "Quanto da pessoa ou do lugar aparece na tela.", terms: asTerms(FRAMINGS) },
  { id: "angulos", title: "Ângulos", intro: "De onde a câmera olha.", terms: asTerms(ANGLES) },
  { id: "movimentos", title: "Movimentos", intro: "O que a câmera faz enquanto grava.", terms: asTerms(MOVEMENTS) },
  {
    id: "publicar",
    title: "Publicar",
    intro: "O texto que acompanha o vídeo.",
    terms: Object.values(POST_PARTS).map((t) => ({ term: t.label, what: t.what, why: t.why })),
  },
  { id: "regras", title: "Regras do set", intro: "O que separa um vídeo amador de um vídeo bem feito, mesmo no celular.", terms: SET_RULES.map((t) => ({ term: t.label, what: t.what, why: t.why })) },
];

export default function AprendaPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="label-set text-muted-foreground">Aprenda</p>
        <h1 className="font-display text-[32px]">O básico do set</h1>
        <p className="leading-relaxed text-muted-foreground">Os termos que aparecem no caminho, sem complicação.</p>
      </header>

      <nav aria-label="Assuntos" className="-mx-5 flex gap-2 overflow-x-auto px-5">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="flex min-h-11 items-center rounded-full border border-input bg-card px-4 text-sm font-semibold whitespace-nowrap">
            {s.title}
          </a>
        ))}
      </nav>

      {SECTIONS.map((s) => (
        <Section key={s.id} {...s} />
      ))}
    </div>
  );
}
