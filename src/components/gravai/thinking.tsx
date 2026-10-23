// "Pensando nas ideias" com três pontinhos se mexendo, para a pessoa ver que o Gravaí está trabalhando.
export function Thinking({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      {label}
      <span className="inline-flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="thinking-dot size-1.5 rounded-full bg-current" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
    </span>
  );
}
