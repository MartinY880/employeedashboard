// ProConnect — Auth Server Actions
// Sign-in and sign-out via Logto SDK

"use server";

import { logtoConfig, isLogtoConfigured } from "@/lib/logto";
import { redirect } from "next/navigation";

export async function signInAction() {
  if (!isLogtoConfigured) {
    redirect("/dashboard");
    return;
  }

  const { signIn } = await import("@logto/next/server-actions");
  await signIn(logtoConfig, {
    redirectUri: `${logtoConfig.baseUrl}/callback`,
  });
}

export async function signOutAction() {
  if (!isLogtoConfigured) {
    redirect("/sign-in");
    return;
  }

  const { signOut } = await import("@logto/next/server-actions");
  await signOut(logtoConfig, `${logtoConfig.baseUrl}/sign-in`);
}
