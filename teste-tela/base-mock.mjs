// O que os testes com o Supabase de mentira têm em comum.
import { chromium } from "playwright-core";

export const APP = "http://localhost:3002";
const DB = "http://localhost:54399";
export const reset = (s = {}) => fetch(`${DB}/__reset`, { method: "POST", body: JSON.stringify(s) });
export const estado = async () => (await fetch(`${DB}/__state`)).json();
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "u1", role: "authenticated", exp: 9999999999, aud: "authenticated" })}.assinatura`;
const usuario = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "t@exemplo.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const cookie = { name: "sb-localhost-auth-token", value: encodeURIComponent(JSON.stringify({ access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: 9999999999, refresh_token: "r", user: usuario })), domain: "localhost", path: "/" };
export const check = (nome, ok, extra = "") => console.log(ok ? "ok    " : "FALHOU", nome, extra);

export async function abrir(viewport = { width: 375, height: 812 }) {
  const b = await chromium.launch({ channel: "chrome", headless: true });
  const c = await b.newContext({ viewport, deviceScaleFactor: Number(process.env.ESCALA ?? 2), hasTouch: true, isMobile: true });
  await c.addCookies([cookie]);
  const p = await c.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  return { b, c, p, erros };
}
