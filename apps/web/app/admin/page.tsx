import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getOptionalServerSessionFromHeaders } from "@/lib/auth/session";
import { isAdminHandle } from "@/lib/auth/admin";
import { getServerLocale } from "@/lib/i18n/server";
import { DynamicRouteShell } from "@/components/DynamicRouteShell";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { AdminDashboardClient } from "./AdminDashboardClient";

export const metadata: Metadata = {
  title: "Admin Panel — Chapa",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = getOptionalServerSessionFromHeaders(await headers());
  if (!session) redirect("/");

  if (!isAdminHandle(session.login)) redirect("/");

  const locale = await getServerLocale();

  return (
    // #1194 — dynamic route: navbar plus both locale corrections, together.
    <DynamicRouteShell locale={locale}>
      <main id="main-content" className="mx-auto max-w-7xl px-6 pt-24 pb-24">
        <h1 className="sr-only">Admin Dashboard</h1>
        <AdminDashboardClient />
      </main>
      <GlobalCommandBarLazy isAdmin />
    </DynamicRouteShell>
  );
}
