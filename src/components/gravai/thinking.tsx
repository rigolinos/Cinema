"use client";

import { useEffect, useState } from "react";

// "Pensando nas ideias" com três pontinhos se mexendo, para a pessoa ver que o Gravaí está trabalhando.
// Com steps, a frase anda enquanto a IA trabalha ("lendo o seu briefing…", "testando ganchos…"):
// espera longa parece menor quando algo acontece na tela. A última frase fica até terminar.
export function Thinking({ label, steps }: { label: string; steps?: string[] }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!steps?.length) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 2800);
    return () => clearInterval(t);
  }, [steps]);

  const text = steps?.length ? steps[step] : label;
  return (
    <span role="status" className="inline-flex items-center gap-2">
      {text}
      <span className="inline-flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="thinking-dot size-1.5 rounded-full bg-current" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
    </span>
  );
}

// Frases de cada espera longa, na ordem do que a IA faz de verdade.
export const STEPS = {
  ideias: ["Lendo o que você me contou", "Pensando em várias situações", "Testando ganchos", "Escolhendo as melhores"],
  roteiro: ["Lendo a sua ideia", "Montando o começo", "Escrevendo as falas", "Conferindo o tempo"],
  sugestoes: ["Lendo o seu roteiro", "Olhando o gancho", "Conferindo o ritmo", "Separando o que vale mudar"],
  organizar: ["Lendo o seu roteiro", "Separando as partes", "Conferindo que nada mudou"],
  publicar: ["Lendo o roteiro", "Escrevendo a legenda de cada plataforma", "Escolhendo a capa"],
  ideiaPropria: ["Lendo a sua ideia", "Testando ganchos", "Deixando pronta para gravar"],
};
