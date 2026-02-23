// ProConnect — Sign-In Route Handler
// Immediately initiates Logto OIDC flow — no intermediate page needed

import { NextResponse } from "next/server";
import { isLogtoConfigured, logtoConfig } from "@/lib/logto";
import { signIn } from "@logto/next/server-actions";

export async function GET() {
  if (!isLogtoConfigured) {
    return NextResponse.redirect(new URL("/dashboard", logtoConfig.baseUrl));
  }

  await signIn(logtoConfig, {
    redirectUri: `${logtoConfig.baseUrl}/callback`,
  });

  // signIn() throws a redirect internally; this is a fallback
  return NextResponse.redirect(new URL("/dashboard", logtoConfig.baseUrl));
}
