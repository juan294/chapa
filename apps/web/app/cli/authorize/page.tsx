import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { readSessionCookie } from "@/lib/auth/github";
import { AuthorizeClient } from "./AuthorizeClient";

interface Props {
  searchParams: Promise<{ session?: string }>;
}

export default async function CliAuthorizePage({ searchParams }: Props) {
  const params = await searchParams;
  const sessionId = params.session;

  if (!sessionId) {
    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center bg-bg px-6">
        <div className="w-full max-w-md rounded-xl border border-stroke bg-card p-8">
          <h1 className="font-heading text-xl font-bold text-text-primary mb-4">
            Authorize Chapa CLI
          </h1>
          <p className="text-terminal-red font-heading text-sm">
            Missing session parameter. Run &quot;chapa login&quot; from your terminal.
          </p>
        </div>
      </main>
    );
  }

  // Check if user is logged in
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    redirect("/");
  }

  const headerStore = await headers();
  const session = readSessionCookie(headerStore.get("cookie"), secret);

  if (!session) {
    // Redirect to login, then back here
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() ?? "";
    const returnUrl = `${baseUrl}/cli/authorize?session=${encodeURIComponent(sessionId)}`;
    redirect(`/api/auth/login?redirect=${encodeURIComponent(returnUrl)}`);
  }

  return <AuthorizeClient sessionId={sessionId} handle={session.login} />;
}
