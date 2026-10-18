"use server";

import { redirect } from "next/navigation";

import { auth, signIn, signOut } from "@/auth";
import { deleteUserById } from "@/server/database/repositories/users";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/home" });
}

export async function signInWithGoogleToChat() {
  await signIn("google", { redirectTo: "/chat" });
}

export async function signOutUser() {
  await signOut({ redirectTo: "/login" });
}

export async function deleteUserByIdAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = String(formData.get("userId") ?? "").trim();
  const deleted = await deleteUserById(userId);
  redirect(deleted ? "/admin?deleted=1" : "/admin?deleteError=1");
}
