import { assetLinks } from "@/lib/android";

// /.well-known/assetlinks.json: lido pelo Android para confiar no app da Google Play (TWA).
export function GET() {
  return Response.json(assetLinks(process.env.ANDROID_PACKAGE, process.env.ANDROID_SHA256), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
