// Aprenda: os termos que aparecem no caminho, explicados em uma linha e com o porquê.
// Planos, ângulos, luz e som entram junto com o passo Planos.
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
    term: "Chamada final",
    what: "O pedido no fim do vídeo: seguir, comentar, salvar, comprar.",
    why: "Quem gostou precisa saber o que fazer em seguida. Peça uma coisa só.",
  },
  {
    term: "Roteiro",
    what: "O texto do vídeo dividido em partes: o que você fala, o que aparece escrito e o que acontece em cena.",
    why: "Com roteiro você grava mais rápido e não esquece o que ia dizer.",
  },
  {
    term: "Decupagem",
    what: "Dividir cada parte do roteiro nas tomadas que você vai gravar.",
    why: "Fazer isso antes evita descobrir na edição que faltou um take.",
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

export default function AprendaPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="label-set text-muted-foreground">Aprenda</p>
        <h1 className="font-display text-[32px]">O básico do set</h1>
        <p className="leading-relaxed text-muted-foreground">Os termos que aparecem no caminho, sem complicação.</p>
      </header>

      <dl className="flex flex-col gap-3">
        {TERMS.map((t) => (
          <div key={t.term} className="flex flex-col gap-1.5 rounded-2xl bg-card p-4">
            <dt className="text-lg font-bold">{t.term}</dt>
            <dd className="text-[15px] leading-relaxed">{t.what}</dd>
            <dd className="text-sm leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">Por quê:</strong> {t.why}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
