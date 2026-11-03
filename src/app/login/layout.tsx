import type { Viewport } from "next";

// O topo da entrada é escuro: a barra do navegador acompanha.
export const viewport: Viewport = { themeColor: "#0E0E0E" };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
