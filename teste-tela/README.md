# Teste de tela com Supabase de mentira

Kit para ver o app funcionando no navegador sem tocar no banco real nem gastar IA.
O `mock-supabase.mjs` responde no lugar do Supabase, com dados inventados e guardados em memória.
Os scripts abrem o app num Chrome de celular (375 × 812) e tiram prints.

## Preparar (uma vez)

```bash
npm install --prefix teste-tela
```

Usa o Chrome instalado na máquina (`channel: "chrome"`), então não baixa navegador.

## Rodar

1. Build apontando para o mock. Este build **não pode ir para a Vercel**; depois do teste, rode `npm run check` de novo, que refaz o build normal.

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-de-teste npx next build
   ```

2. Suba o mock e o app em dois terminais (ou pelo `.claude/launch.json`, que fica fora do git):

   ```bash
   node teste-tela/mock-supabase.mjs
   ```

   ```bash
   npx next start -p 3002
   ```

3. Rode um teste, passando a pasta dos prints:

   ```bash
   node teste-tela/testar-guardadas.mjs teste-tela/prints
   ```

   Cada verificação imprime `ok` ou `FALHOU`.

4. Ao terminar: pare os dois servidores e rode `npm run check`. Confira que o build não aponta mais para o mock:
   nenhum `localhost:54399` dentro de `.next/static`.

## Peças

- `mock-supabase.mjs`: o banco de mentira na porta 54399. `POST /__reset` recomeça com os dados de exemplo
  (ou com o estado mandado no corpo); `GET /__state` mostra o que o app gravou.
- `base-mock.mjs`: o que todo teste usa: `reset`, `estado`, `abrir` (já logado) e `check`.
- `testar-*.mjs` e `cabecalho.mjs`: testes de rodadas anteriores, bons como exemplo e para conferir se algo voltou a quebrar.
  As respostas da IA são simuladas com `page.route`, então nenhum teste chama a IA de verdade.

Todos os nomes e e-mails nos dados são inventados.
