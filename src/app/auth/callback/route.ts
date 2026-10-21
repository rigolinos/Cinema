import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth-errors";

// Volta do e-mail (confirmação de cadastro ou troca de senha): troca o código pela sessão e segue.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  const login = new URL("/login", url.origin);
  login.searchParams.set("aviso", "link");
  return NextResponse.redirect(login);
}
