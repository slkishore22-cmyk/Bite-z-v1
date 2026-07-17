export const inr = (n: number | null | undefined) =>
  `₹${Math.round(Number(n ?? 0)).toLocaleString("en-IN")}`;

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const daysAgoISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

export const CHART_COLORS = [
  "#2563EB", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899",
  "#06B6D4", "#F97316", "#A855F7", "#10B981",
];

export const tooltipStyle = {
  background: "#1C1C2E",
  border: "1px solid #2563EB",
  borderRadius: 8,
  color: "white",
  fontSize: 12,
};

export const axisStyle = { fill: "#6B7280", fontSize: 11 };