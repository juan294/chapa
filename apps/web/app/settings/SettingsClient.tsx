"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import {
  usePlatformConnections,
  clearPlatformStatusCache,
  type PlatformId,
} from "@/lib/platform/use-platform-connections";
import { useInsightsImport } from "@/lib/insights/use-insights-import";
import { clearSessionCache } from "@/hooks/useSession";
import { clearCacheWarmState } from "@/hooks/useOwnerCacheWarm";
import { BitbucketIcon, CodebergIcon, GitlabIcon } from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Toast } from "@/components/Toast";

interface SettingsClientProps {
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

const PLATFORM_META: Record<
  PlatformId,
  { label: string; Icon: typeof BitbucketIcon; profileUrl: (login: string) => string }
> = {
  bitbucket: {
    label: "Bitbucket",
    Icon: BitbucketIcon,
    profileUrl: (l) => `https://bitbucket.org/${l}/`,
  },
  codeberg: {
    label: "Codeberg",
    Icon: CodebergIcon,
    profileUrl: (l) => `https://codeberg.org/${l}`,
  },
  gitlab: {
    label: "GitLab",
    Icon: GitlabIcon,
    profileUrl: (l) => `https://gitlab.com/${l}`,
  },
};

const CONFIRM_KEYS: Record<PlatformId, { title: string; body: string }> = {
  bitbucket: {
    title: "userMenu.confirmUnlinkBitbucketTitle",
    body: "userMenu.confirmUnlinkBitbucketBody",
  },
  codeberg: {
    title: "userMenu.confirmUnlinkCodebergTitle",
    body: "userMenu.confirmUnlinkCodebergBody",
  },
  gitlab: {
    title: "userMenu.confirmUnlinkGitlabTitle",
    body: "userMenu.confirmUnlinkGitlabBody",
  },
};

const LINK_KEYS: Record<PlatformId, string> = {
  bitbucket: "userMenu.linkBitbucket",
  codeberg: "userMenu.linkCodeberg",
  gitlab: "userMenu.linkGitlab",
};

function Section({
  command,
  title,
  description,
  children,
}: {
  command: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-1 flex items-baseline gap-2 border-b border-stroke-strong pb-2">
        <span className="font-heading text-sm text-terminal-dim">%</span>
        <h2 className="font-heading text-sm text-text-secondary">{command}</h2>
      </div>
      <h3 className="sr-only">{title}</h3>
      <p className="mb-4 mt-3 text-sm leading-relaxed text-text-secondary">
        {description}
      </p>
      {children}
    </section>
  );
}

export function SettingsClient({ login, name, avatarUrl }: SettingsClientProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { insightsEnabled } = useClientFeatureFlags();
  const { connections, unlink } = usePlatformConnections();
  const insights = useInsightsImport(login);
  const [pendingUnlink, setPendingUnlink] = useState<PlatformId | null>(null);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const visibleConnections = connections.filter((c) => c.enabled);

  async function handleConfirmUnlink() {
    if (!pendingUnlink) return;
    const ok = await unlink(pendingUnlink);
    if (ok) {
      setPendingUnlink(null);
      setUnlinkError(null);
      router.refresh();
    } else {
      setUnlinkError(t("userMenu.unlinkFailed") as string);
    }
  }

  async function handleSignOut() {
    // Clear all module-level per-user caches before navigating away, so a
    // different user logging in in the same tab never sees the previous one's
    // session, platform links or cache-warm state (#732).
    clearSessionCache();
    clearPlatformStatusCache();
    clearCacheWarmState();
    await fetch("/api/auth/logout", { method: "POST" });
    // A full reload is intentional: it discards all client and router state
    // after the server clears the session cookie.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 font-heading text-2xl font-bold tracking-tight text-text-primary text-balance">
        {t("settings.title") as string}
      </h1>
      <p className="mb-10 text-pretty text-sm leading-relaxed text-text-secondary">
        {t("settings.intro") as string}
      </p>

      {/* --- Identity --- */}
      <Section
        command="chapa whoami"
        title={t("settings.identityTitle") as string}
        description={t("settings.identityDescription") as string}
      >
        <div
          className="flex items-center gap-4 rounded-xl border border-stroke bg-card p-4"
          data-testid="settings-identity"
        >
          {avatarUrl && !imgError ? (
            <Image
              src={avatarUrl}
              alt=""
              width={48}
              height={48}
              className="img-outline rounded-full"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber/10 font-semibold text-amber">
              {login.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-heading text-sm text-text-primary">
              {name ?? login}
            </div>
            <div className="truncate text-xs text-text-secondary">@{login}</div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="min-h-[44px] rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-amber/20 hover:text-text-primary"
          >
            {t("userMenu.signOut") as string}
          </button>
        </div>
      </Section>

      {/* --- Connections --- */}
      <Section
        command="chapa connections"
        title={t("settings.connectionsTitle") as string}
        description={t("settings.connectionsDescription") as string}
      >
        {visibleConnections.length === 0 ? (
          <p
            className="rounded-xl border border-stroke bg-card p-4 text-sm text-text-secondary"
            data-testid="settings-no-connections"
          >
            {t("settings.connectionsUnavailable") as string}
          </p>
        ) : (
          <ul className="space-y-2">
            {visibleConnections.map(({ platform, status, unlinking }) => {
              const meta = PLATFORM_META[platform];
              const Icon = meta.Icon;
              return (
                <li
                  key={platform}
                  data-testid={`settings-connection-${platform}`}
                  className="flex items-center gap-3 rounded-xl border border-stroke bg-card p-4"
                >
                  <Icon className="h-5 w-5 shrink-0 text-text-secondary" />
                  <div className="min-w-0 flex-1">
                    <div className="font-heading text-sm text-text-primary">
                      {meta.label}
                    </div>
                    {status?.linked ? (
                      <a
                        href={meta.profileUrl(status.remoteLogin ?? "")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-xs text-complement-text transition-colors hover:text-complement-text-hover"
                      >
                        @{status.remoteLogin}
                      </a>
                    ) : (
                      <div className="text-xs text-text-secondary">
                        {t("settings.notConnected") as string}
                      </div>
                    )}
                  </div>
                  {status?.linked ? (
                    <button
                      type="button"
                      onClick={() => {
                        setUnlinkError(null);
                        setPendingUnlink(platform);
                      }}
                      disabled={unlinking}
                      className="min-h-[44px] rounded-lg border border-stroke px-4 py-2 text-sm text-text-secondary transition-colors hover:border-terminal-red/40 hover:text-terminal-red disabled:opacity-50"
                    >
                      {t("userMenu.unlinkBtn") as string}
                    </button>
                  ) : (
                    <a
                      href={`/api/auth/${platform}/connect`}
                      className="flex min-h-[44px] items-center rounded-lg bg-amber-dark px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber"
                    >
                      {t(LINK_KEYS[platform]) as string}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {unlinkError && (
          <p
            className="mt-3 rounded-lg border border-terminal-red/30 bg-terminal-red/10 p-3 text-sm text-terminal-red"
            role="alert"
          >
            {unlinkError}
          </p>
        )}
      </Section>

      {/* --- AI insights --- */}
      {insightsEnabled && (
        <Section
          command="chapa insights"
          title={t("settings.insightsTitle") as string}
          description={t("settings.insightsDescription") as string}
        >
          <div
            className="rounded-xl border border-stroke bg-card p-4"
            data-testid="settings-insights"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".html,text/html"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void insights.importFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={insights.cooldownActive}
              title={insights.cooldownTooltip}
              className="min-h-[44px] rounded-lg bg-amber-dark px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("userMenu.importInsights") as string}
            </button>
            {insights.cooldownTooltip && (
              <p className="mt-3 text-xs text-text-secondary">
                {insights.cooldownTooltip}
              </p>
            )}
          </div>
        </Section>
      )}

      {pendingUnlink && (
        <ConfirmDialog
          open
          title={t(CONFIRM_KEYS[pendingUnlink].title) as string}
          description={t(CONFIRM_KEYS[pendingUnlink].body) as string}
          confirmLabel={t("userMenu.confirmBtn") as string}
          cancelLabel={t("userMenu.cancelBtn") as string}
          variant="destructive"
          loading={
            connections.find((c) => c.platform === pendingUnlink)?.unlinking ??
            false
          }
          onConfirm={() => void handleConfirmUnlink()}
          onCancel={() => setPendingUnlink(null)}
        />
      )}

      {insights.toast && (
        <Toast
          message={insights.toast.message}
          detail={insights.toast.detail}
          type={insights.toast.type}
          onDismiss={insights.dismissToast}
        />
      )}
    </div>
  );
}
