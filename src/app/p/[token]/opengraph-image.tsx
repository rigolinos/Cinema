import { OG_SIZE, ogImage } from "@/lib/og-imagem";
import { firstNameOf, rolesYou } from "@/lib/pessoas";
import { getPart, partRoles } from "./dados";

// A imagem da prévia do link (WhatsApp, Instagram): a primeira propaganda do Gravaí para quem foi chamado.
// Feita para cada pessoa: o nome dela, o vídeo e o papel. Sem o link valer, sai só a marca.
export const alt = "Convite para gravar no Gravaí";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const part = await getPart((await params).token);
  const image = await ogImage({
    label: part ? "CONVITE PARA GRAVAR" : "GRAVAÍ",
    headline: part ? `${firstNameOf(part.person.name)}, você está no time.` : "Da ideia ao vídeo gravado.",
    sub: part ? `“${part.video.title}” · ${rolesYou(partRoles(part))}` : "Roteiro, planos e gravação no celular.",
  });
  // A imagem inteira, com o tamanho declarado, como a do link principal: gerada na hora, ela sairia sem tamanho.
  const png = await image.arrayBuffer();
  return new Response(png, { headers: { "Content-Type": contentType, "Content-Length": String(png.byteLength) } });
}
