"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { AuthorTypewriter } from "@/components/AuthorTypewriter";
import { TerminalInput } from "@/components/terminal/TerminalInput";
import { parseCommand } from "@/components/terminal/command-registry";

export function LandingTerminal() {
  const router = useRouter();

  const handleSubmit = useCallback(
    (input: string) => {
      const parsed = parseCommand(input);
      if (!parsed) return;

      switch (parsed.name) {
        case "/studio":
          router.push("/studio");
          break;
        case "/login":
          window.location.href = "/api/auth/login";
          break;
        case "/badge":
        case "/b": {
          const handle = parsed.args[0]?.replace(/^@/, "");
          if (handle) router.push(`/u/${handle}`);
          break;
        }
        case "/about":
          router.push("/about");
          break;
        default:
          break;
      }
    },
    [router],
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stroke bg-bg/90 backdrop-blur-xl">
      <div className="relative mx-auto max-w-4xl">
        <AuthorTypewriter className="hidden md:flex absolute right-full mr-4 top-1/2 -translate-y-1/2" />
        <TerminalInput
          onSubmit={handleSubmit}
          prompt="chapa"
          autoFocus={false}
        />
      </div>
    </div>
  );
}
