// A pessoa guarda a própria ideia: pelo campo em Guardadas e pelo "Guardar para depois" de "Já tenho a ideia".
// Supabase de mentira; as ideias guardadas ficam numa lista em memória do teste.
import path from "node:path";
import { APP, abrir, check, estado, reset } from "./base-mock.mjs";

const out = process.argv[2];
await reset();
const e0 = await estado();
const { b, p, erros } = await abrir();
let lista = [];
await p.route("**/rest/v1/saved_ideas*", async (route) => {
  const req = route.request();
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (req.method() === "GET") return json(lista);
  if (req.method() === "POST") {
    const row = { id: `s${lista.length + 1}`, source_id: `auto${lista.length + 1}`, payoff: "", video_id: null, created_at: "2026-11-27T12:00:00Z", ...req.postDataJSON() };
    lista = [row, ...lista];
    return json(row, 201);
  }
  if (req.method() === "DELETE") {
    const id = new URL(req.url()).searchParams.get("id")?.replace("eq.", "");
    lista = lista.filter((i) => i.id !== id);
    return json([]);
  }
  return json([]);
});
const texto = "Minha mãe ligando três vezes para saber se eu comi. Na última ela já está na porta.";

// ── Em Guardadas
await p.goto(`${APP}/ideias/guardadas`, { waitUntil: "networkidle" });
await p.getByLabel("Guardar uma ideia minha").fill(texto);
await p.getByRole("button", { name: "Guardar", exact: true }).click();
await p.getByText("Sua ideia").waitFor();
let t = await p.locator("body").innerText();
check("guarda e mostra com a etiqueta Sua ideia", t.includes("Minha mãe ligando três vezes\n") && t.includes(texto));
check("vai para o banco como ideia da pessoa", lista[0]?.source === "pessoa" && lista[0]?.brief === texto, JSON.stringify(lista[0] ?? {}).slice(0, 120));
check("o campo fica limpo para a próxima", (await p.getByLabel("Guardar uma ideia minha").inputValue()) === "");
await p.screenshot({ path: path.join(out, "ip-1-guardadas.png"), fullPage: true });
await p.getByRole("button", { name: /Apagar a sua ideia/ }).click();
await p.getByRole("button", { name: "Apagar", exact: true }).click();
await p.waitForTimeout(300);
check("apagar pede confirmação e tira da lista", lista.length === 0 && (await p.getByText("Sua ideia").count()) === 0);

// ── Em "Já tenho a ideia"
await reset({ videos: e0.videos.map((v) => (v.id === "draft" ? { ...v, start_door: "ideia" } : v)) });
await p.goto(`${APP}/video/draft/ideia`, { waitUntil: "networkidle" });
await p.getByLabel("Sua ideia").fill(texto);
await p.screenshot({ path: path.join(out, "ip-2-ja-tenho.png") });
await p.getByRole("button", { name: "Guardar para depois" }).click();
await p.waitForURL("**/ideias/guardadas");
await p.getByText("Sua ideia").waitFor();
check("Guardar para depois leva às guardadas, com a ideia lá", lista.length === 1 && lista[0].brief === texto);
const e = await estado();
check("e o vídeo não anda para o roteiro", e.videos.find((v) => v.id === "draft").stage === "ideia");
check("sem erros", erros.length === 0, erros.join(" | "));
await b.close();
