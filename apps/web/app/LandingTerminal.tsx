"use client";

import { useCallback, useMemo } from "react";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { createLandingCommands } from "@/components/landing/landing-commands";
import { makeLine, type CommandAction } from "@/components/terminal/command-registry";
import { useTranslation } from "@/lib/i18n";
import { tObject } from "@/lib/i18n/typed-accessors";

export function LandingTerminal() {
  const { t } = useTranslation();
  const descriptions = useMemo(() => tObject<Record<string, string>>(t, "commands.descriptions"), [t]);
  const messages = useMemo(() => tObject<Record<string, string>>(t, "commands.messages"), [t]);
  const commands = useMemo(() => createLandingCommands(descriptions, messages), [descriptions, messages]);
  const handleAction = useCallback(async (action: Extract<CommandAction, {type: "custom"}>) => {
    if (action.event === "chapa:landing-copy") {
      const copied = await new Promise<boolean>(complete => window.dispatchEvent(new CustomEvent(action.event, {detail: {complete}})));
      return [makeLine(copied ? "success" : "error", copied ? messages.copySuccess! : messages.copyFailure!)];
    }
    if (action.event === "chapa:landing-section") {
      const id = action.detail?.id;
      if (typeof id === "string") document.getElementById(id)?.scrollIntoView({behavior: "instant", block: "start"});
    } else {
      window.dispatchEvent(new CustomEvent(action.event, {detail: action.detail}));
    }
    return undefined;
  }, [messages]);
  return <GlobalCommandBarLazy scopedCommands={commands} onCustomAction={handleAction} />;
}
