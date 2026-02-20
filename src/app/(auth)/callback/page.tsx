// ProConnect — Logto OIDC Callback
// Handles the redirect back from Logto after authentication

import { isLogtoConfigured, logtoConfig } from "@/lib/logto";
import { redirect } from "next/navigation";

export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  // Dev bypass — nothing to handle
  if (!isLogtoConfigured) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const { handleSignIn } = await import("@logto/next/server-actions");

  try {
    await handleSignIn(logtoConfig, new URLSearchParams(params));
  } catch (error) {
    // If callback fails, redirect to sign-in
    console.error("[ProConnect] Auth callback failed:", error);
    redirect("/sign-in");
  }

  // handleSignIn may already redirect via postRedirectUri;
  // fallback redirect to dashboard
  redirect("/dashboard");
}
