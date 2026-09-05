"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/auth";
import { acceptCurrentPolicy } from "@/server/modules/consent/consent.service";

export async function aceitarConsentimentoAction() {
  const user = await requireUser({ skipConsentGate: true });
  await acceptCurrentPolicy(user.id, user.tokenVersion ?? 0);
  redirect("/dashboard");
}
