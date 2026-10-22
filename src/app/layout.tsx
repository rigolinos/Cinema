import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { InstallCapture } from "@/components/gravai/instalar";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Gravaí: da ideia ao vídeo gravado",
  description:
    "Crie a ideia, escreva o roteiro, planeje cada plano e grave com um parceiro de set que explica cada passo.",
  applicationName: "Gravaí",
  appleWebApp: { capable: true, title: "Gravaí", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ECECE8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <InstallCapture />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
