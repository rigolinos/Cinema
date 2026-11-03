import type { Viewport } from "next";

// O topo do cadastro é escuro, como o da entrada: a barra do navegador acompanha.
export const viewport: Viewport = { themeColor: "#0E0E0E" };

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
