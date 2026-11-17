// Ideias guardadas à vista no Início e no Novo vídeo; a quinzena sai das duas telas.
import path from "node:path";
import { APP, abrir, check, reset } from "./base-mock.mjs";

const out = process.argv[2];
const guardadas = [
  { id: "g1", title: "Alarme do carro", hook: "", situation: "Ela trava o carro e esquece.", payoff: "", why: "", source: "video", source_id: "i9", format_slug: null, created_at: "2026-11-10T00:00:00Z" },
  { id: "g2", title: "Pilates em casa", hook: "", situation: "Três erros na prancha.", payoff: "", why: "", source: "quinzena", source_id: "q9", format_slug: null, created_at: "2026-11-11T00:00:00Z" },
];

for (const [nome, lista] of [["com guardadas", guardadas], ["sem guardadas", []]]) {
  await reset();
  const { b, p, erros } = await abrir();
  let quinzena = 0;
  await p.route("**/api/ideias-quinzena", (r) => {
    quinzena += 1;
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ideas: [] }) });
  });
  await p.route("**/rest/v1/saved_ideas*", (route) =>
    route.request().method() === "GET" ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(lista) }) : route.continue(),
  );

  await p.goto(`${APP}/inicio`, { waitUntil: "networkidle" });
  await p.getByRole("heading", { name: /O que vamos/ }).waitFor();
  await p.waitForTimeout(500);
  const inicio = await p.locator("main, body").first().innerText();
  check(`${nome}: a quinzena saiu do Início`, !inicio.includes("Ideias da quinzena"));
  const cartao = p.getByRole("link", { name: /Ideias guardadas/ });
  if (lista.length) {
    check(`${nome}: o Início mostra as guardadas com a contagem`, (await cartao.count()) === 1 && inicio.includes("2 ideias para gravar depois"));
    await p.screenshot({ path: path.join(out, "guardadas-1-inicio.png") });
    await cartao.click();
    await p.waitForURL("**/ideias/guardadas");
    await p.getByText("Alarme do carro").waitFor();
    check(`${nome}: um toque abre as guardadas`, true);
  } else {
    check(`${nome}: sem guardadas, sem cartão`, (await cartao.count()) === 0);
  }

  await p.goto(`${APP}/novo`, { waitUntil: "networkidle" });
  await p.getByRole("heading", { name: "Mais ideias" }).waitFor();
  await p.waitForTimeout(400);
  const linhas = (await p.getByRole("region", { name: "Mais ideias" }).getByRole("link").allInnerTexts()).map((x) => x.split("\n")[0].trim());
  check(
    `${nome}: no Novo vídeo, ${lista.length ? "as guardadas vêm primeiro" : "só a biblioteca"} e sem quinzena`,
    lista.length ? linhas[0] === "Ideias guardadas (2)" && linhas.length === 2 : linhas.join() === "Biblioteca de formatos",
    linhas.join(" | "),
  );
  if (lista.length) await p.screenshot({ path: path.join(out, "guardadas-2-novo.png"), fullPage: true });
  check(`${nome}: Início e Novo vídeo não pedem ideias da quinzena à IA`, quinzena === 0);
  check(`${nome}: sem erros`, erros.length === 0, erros.join(" | "));
  await b.close();
}
await reset();
