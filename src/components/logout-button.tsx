"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sair
    </button>
  );
}
