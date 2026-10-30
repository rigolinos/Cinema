import { ImageResponse } from "next/og";
import { rolesYou } from "@/lib/pessoas";
import { firstNameOf, getPart, partRoles } from "./dados";

// A imagem da prévia do link (WhatsApp, Instagram): a primeira propaganda do Gravaí para quem foi chamado.
// Feita para cada pessoa: o nome dela, o vídeo e o papel. Sem o link valer, sai só a marca.
export const alt = "Convite para gravar no Gravaí";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GRAFITE = "#161616";
const CONCRETO = "#F2F2EE";
const REC = "#D92D20";

// As fontes do app vêm do Google Fonts só com as letras usadas; se não vierem, a imagem sai com a fonte padrão.
async function googleFont(family: string, axes: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:${axes}&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const part = await getPart((await params).token);
  const headline = part ? `${firstNameOf(part.person.name)}, você está no time.` : "Da ideia ao vídeo gravado.";
  const sub = part ? `“${part.video.title}” · ${rolesYou(partRoles(part))}` : "Roteiro, planos e gravação no celular.";
  const label = part ? "CONVITE PARA GRAVAR" : "GRAVAÍ";

  const [display, body, mono] = await Promise.all([
    googleFont("Archivo", "wdth,wght@125,800", `gravaı${headline}`),
    googleFont("Archivo", "wght@500", sub),
    googleFont("IBM+Plex+Mono", "wght@500", label),
  ]);
  const fonts = [
    display && { name: "Display", data: display, weight: 800 as const },
    body && { name: "Body", data: body, weight: 500 as const },
    mono && { name: "Mono", data: mono, weight: 500 as const },
  ].filter((f): f is { name: string; data: ArrayBuffer; weight: 800 | 500 } => Boolean(f));

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: GRAFITE, color: CONCRETO, padding: "64px 72px" }}>
        {/* A marca: "grava" e o ı com o pingo vermelho, a luz de gravação. */}
        <div style={{ display: "flex", alignItems: "flex-end", fontFamily: "Display", fontSize: 64, lineHeight: 1, letterSpacing: "-0.03em" }}>
          <span>grava</span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 13, height: 13, borderRadius: 13, background: REC, marginBottom: -20 }} />
            <span>ı</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <span style={{ fontFamily: "Mono", fontSize: 26, letterSpacing: "0.08em", color: "#A0A09A" }}>{label}</span>
          <span style={{ fontFamily: "Display", fontSize: 92, lineHeight: 1, letterSpacing: "-0.03em", maxWidth: 1000 }}>{headline}</span>
          <span style={{ fontFamily: "Body", fontSize: 34, color: "#D8D8D2", maxWidth: 1000 }}>{sub}</span>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
