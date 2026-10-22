// Instalar o Gravaí na tela de início. Cada navegador faz de um jeito; aqui só se decide qual caminho mostrar.

export type InstallMode =
  | "instalado" // já está aberto como app
  | "direto" // Android/Chrome liberou a janela de instalação
  | "iphone" // Safari: Compartilhar › Adicionar à Tela de Início
  | "outro-app" // navegador de dentro do Instagram, TikTok etc.: precisa abrir no Chrome ou no Safari
  | "menu"; // Android sem a janela: pelo menu do navegador

const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Bytedance|Line\/|Snapchat|Twitter/i;

export function isIos(ua: string, touchPoints = 0): boolean {
  // iPad recente se apresenta como Mac; o toque denuncia.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
}

export function installMode(input: { ua: string; standalone: boolean; canPrompt: boolean; touchPoints?: number }): InstallMode {
  if (input.standalone) return "instalado";
  if (IN_APP.test(input.ua)) return "outro-app";
  if (input.canPrompt) return "direto";
  if (isIos(input.ua, input.touchPoints)) return "iphone";
  return "menu";
}
