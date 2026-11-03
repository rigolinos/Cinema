import { OG_SIZE, ogImage } from "@/lib/og-imagem";

// A prévia do link do site: o que aparece quando alguém compartilha o Gravaí.
export const alt = "Gravaí: da ideia ao vídeo gravado";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({
    label: "COMECE DE GRAÇA",
    headline: "Da ideia ao vídeo gravado.",
    sub: "Ideia, roteiro e planos do seu vídeo curto, prontos no celular.",
  });
}
