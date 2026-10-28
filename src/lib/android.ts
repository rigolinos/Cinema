// App Android (TWA): o arquivo que prova ao Android que o app da Google Play e este site são do mesmo dono.
// Sem ele, o app abre com a barra do navegador aparecendo. O pacote e as impressões digitais da chave
// de assinatura vêm das variáveis ANDROID_PACKAGE e ANDROID_SHA256 (várias separadas por vírgula:
// a chave de envio e a da Google Play).

const SHA256 = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export function assetLinks(pkg: string | undefined, fingerprints: string | undefined) {
  const name = pkg?.trim() ?? "";
  const certs = (fingerprints ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => SHA256.test(f));
  // Sem pacote válido ou sem chave, a lista fica vazia: o site continua igual e nenhum app é autorizado.
  if (!PACKAGE.test(name) || certs.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: name, sha256_cert_fingerprints: certs },
    },
  ];
}

// O Android abre o app com o endereço de origem "android-app://<pacote>" na primeira página.
export function isTwaReferrer(referrer: string): boolean {
  return referrer.startsWith("android-app://");
}
