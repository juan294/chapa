import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { Navbar } from "@/components/Navbar";
import { GlobalCommandBar } from "@/components/GlobalCommandBar";
import { AdminDashboardClient } from "./AdminDashboardClient";

export const metadata: Metadata = {
  title: "Admin Panel — Chapa",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!sessionSecret) redirect("/");

  const headerStore = await headers();
  const session = readSessionCookie(headerStore.get("cookie"), sessionSecret);
  if (!session) redirect("/");

  if (!isAdminHandle(session.login)) redirect("/");

  return (
    <>
      <Navbar />
      <main id="main-content" className="mx-auto max-w-7xl px-6 pt-24 pb-24">
        <h1 className="sr-only">Admin Dashboard</h1>
        <AdminDashboardClient />
      </main>
      <GlobalCommandBar isAdmin />
    </>
  );
}
