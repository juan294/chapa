"use client";

import { useRef, useState, useEffect } from "react";

interface TerminalSectionProps {
  command: string;
  children: React.ReactNode;
  delay?: number;
  id?: string;
}

export function TerminalSection({
  command,
  children,
  delay = 0,
  id,
}: TerminalSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      className={`transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Command line */}
      <div className="flex items-center gap-2 mb-4 font-heading text-sm">
        <span className="text-terminal-dim select-none">$</span>
        <span className="text-text-secondary">{command}</span>
      </div>

      {/* Output */}
      <div className="pl-4 border-l border-stroke">{children}</div>
    </div>
  );
}
