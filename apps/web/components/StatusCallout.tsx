import type { ReactNode } from "react";

export type StatusVariant = "success" | "error" | "warning" | "verification";

const STATUS_STYLES: Record<
  StatusVariant,
  {
    container: string;
    iconBg: string;
    iconText: string;
    title: string;
    icon: ReactNode;
  }
> = {
  success: {
    container: "border-terminal-green/30 bg-terminal-green/10",
    iconBg: "bg-terminal-green/15",
    iconText: "text-terminal-green",
    title: "text-terminal-green",
    icon: <path d="M20 6L9 17l-5-5" />,
  },
  error: {
    container: "border-terminal-red/30 bg-terminal-red/10",
    iconBg: "bg-terminal-red/15",
    iconText: "text-terminal-red",
    title: "text-terminal-red",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M15 9l-6 6m0-6l6 6" />
      </>
    ),
  },
  warning: {
    container: "border-terminal-yellow/30 bg-terminal-yellow/10",
    iconBg: "bg-terminal-yellow/15",
    iconText: "text-terminal-yellow",
    title: "text-terminal-yellow",
    icon: <path d="M12 9v4m0 4h.01M12 2L2 20h20L12 2z" />,
  },
  verification: {
    container: "border-complement/30 bg-complement/10",
    iconBg: "bg-complement/15",
    iconText: "text-complement",
    title: "text-complement",
    icon: <path d="M20 6L9 17l-5-5" />,
  },
};

export function StatusCallout({
  variant,
  title,
  description,
  children,
  className = "",
  titleAs: Title = "h2",
}: {
  variant: StatusVariant;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
  titleAs?: "h1" | "h2";
}) {
  const styles = STATUS_STYLES[variant];

  return (
    <section
      role={variant === "error" ? "alert" : "status"}
      className={`rounded-xl border p-8 ${styles.container} ${className}`}
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles.iconBg}`}
        >
          <svg
            className={`h-5 w-5 ${styles.iconText}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {styles.icon}
          </svg>
        </div>
        <div>
          <Title className={`font-heading text-xl font-bold ${styles.title}`}>
            {title}
          </Title>
          <p className="text-sm text-text-secondary">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
