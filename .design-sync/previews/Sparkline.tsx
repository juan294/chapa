import { Sparkline } from "@chapa/web";

// juan294's real composite trend, 46 -> 80 over six months.
const trend = [
  { date: "2026-02-15", value: 46 }, { date: "2026-03-15", value: 63 },
  { date: "2026-04-15", value: 70 }, { date: "2026-05-15", value: 72 },
  { date: "2026-06-15", value: 74 }, { date: "2026-07-15", value: 77 },
  { date: "2026-08-29", value: 80 },
];

const flat = trend.map((p, i) => ({ ...p, value: 65 + (i % 2) }));

export const Rising = () => (
  <Sparkline values={trend} color="var(--color-dimension-delivery)" width={220} height={56} />
);

export const Flat = () => (
  <Sparkline values={flat} color="var(--color-dimension-consistency)" width={220} height={56} />
);

export const Wide = () => (
  <Sparkline values={trend} color="var(--color-amber)" width={420} height={72} />
);
