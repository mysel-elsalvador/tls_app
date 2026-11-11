"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser, signOut } from "aws-amplify/auth";
import { setupAuth } from "@/lib/auth";

/** Renders children only for a signed-in user; otherwise goes to /login/. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    setupAuth();
    getCurrentUser()
      .then((u) => setUser(u.signInDetails?.loginId ?? u.username))
      .catch(() => router.replace("/login/"));
  }, [router]);

  if (!user) return <p className="muted center">Cargando…</p>;

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="StationsView, inicio">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimizer */}
          <img src="/logo-ssview.png" alt="StationsView" width={2000} height={300} />
        </Link>
        <span className="topbar-user">
          <span className="muted">{user}</span>
          <button
            type="button"
            className="link-button"
            onClick={async () => {
              await signOut();
              router.replace("/login/");
            }}
          >
            Salir
          </button>
        </span>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
