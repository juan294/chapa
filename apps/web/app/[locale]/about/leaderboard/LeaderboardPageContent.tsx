import Link from "next/link";
import { NavbarClient } from "@/components/NavbarClient";
import { ContentPageHeader } from "@/components/content/ContentPageHeader";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { SiteFooter } from "@/components/SiteFooter";

type TFunction = (key: string) => unknown;

function Section({ heading, body }: { heading: string; body: string }) {
  return (
    <section>
      <h2 className="pt-8 pb-2 font-heading text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
        {heading}
      </h2>
      <p>{body}</p>
    </section>
  );
}

/**
 * Why a given profile holds a given place. Written because the board shows two
 * identical scores in different positions, which reads as favouritism unless
 * the tie rule is stated somewhere the reader can reach.
 */
export function LeaderboardPageContent({ t }: { t: TFunction }) {
  const s = (key: string) => t(`about.leaderboard.${key}`) as string;

  return (
    <div className="min-h-screen bg-bg">
      <NavbarClient />

      <main id="main-content" className="relative mx-auto max-w-3xl px-6 pt-32 pb-24">
        <div className="@container relative">
          <ContentPageHeader command="chapa explain --leaderboard" title={s("h1")} />

          <p className="mb-8 animate-fade-in-up text-lg text-text-secondary [animation-delay:100ms]">
            {s("intro")}
          </p>

          <div className="animate-fade-in-up space-y-2 leading-relaxed text-text-secondary [animation-delay:200ms]">
            <Section heading={s("sectionEligible")} body={s("eligibleBody")} />
            <Section heading={s("sectionRecent")} body={s("recentBody")} />
            <Section heading={s("sectionNumber")} body={s("numberBody")} />
            <Section heading={s("sectionTies")} body={s("tiesBody")} />
            <Section heading={s("sectionRefresh")} body={s("refreshBody")} />

            <section>
              <h2 className="pt-8 pb-2 font-heading text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
                {s("sectionScore")}
              </h2>
              <p>
                {s("scoreLinkPrefix")}
                <Link href="/about/scoring" className="text-amber-text underline underline-offset-4">
                  {s("scoreLink")}
                </Link>
                {s("scoreLinkSuffix")}
              </p>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter t={t} />
      <GlobalCommandBarLazy />
    </div>
  );
}
