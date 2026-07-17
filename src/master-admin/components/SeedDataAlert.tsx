import { useEffect, useState } from "react";
import { db } from "../db";
import { scanForSeedData, isProductionRuntime } from "@/lib/seedDataGuard";

type Finding = { table: string; count: number; sample: string };

// Polls the most public-facing tables for records that look like seed/dummy
// data and surfaces a sticky warning banner inside the admin shell. The check
// is read-only — admins still need to delete the offending rows manually.
export default function SeedDataAlert() {
  const [findings, setFindings] = useState<Finding[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const checks: Promise<Finding | null>[] = [
        (async () => {
          const { data } = await db
            .from("sellers")
            .select("id, name, canteen_name")
            .limit(500);
          const { flagged, reasons } = scanForSeedData(data ?? [], [
            "id", "name", "canteen_name",
          ]);
          if (!flagged.length) return null;
          return {
            table: "sellers",
            count: flagged.length,
            sample: `${(flagged[0] as { canteen_name?: string }).canteen_name ?? "?"} (${reasons.get(flagged[0])})`,
          };
        })(),
        (async () => {
          const { data } = await db
            .from("seller_products")
            .select("id, product_name, category")
            .limit(500);
          const { flagged, reasons } = scanForSeedData(data ?? [], [
            "id", "product_name", "category",
          ]);
          if (!flagged.length) return null;
          return {
            table: "seller_products",
            count: flagged.length,
            sample: `${(flagged[0] as { product_name?: string }).product_name ?? "?"} (${reasons.get(flagged[0])})`,
          };
        })(),
        (async () => {
          const { data } = await db
            .from("seller_offers")
            .select("id, name, condition")
            .limit(500);
          const { flagged, reasons } = scanForSeedData(data ?? [], [
            "id", "name", "condition",
          ]);
          if (!flagged.length) return null;
          return {
            table: "seller_offers",
            count: flagged.length,
            sample: `${(flagged[0] as { name?: string }).name ?? "?"} (${reasons.get(flagged[0])})`,
          };
        })(),
      ];
      const results = (await Promise.all(checks)).filter(Boolean) as Finding[];
      if (!cancelled) setFindings(results);
    };
    void run();
    const t = setInterval(run, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (!findings.length) return null;
  const total = findings.reduce((a, f) => a + f.count, 0);

  return (
    <div
      role="alert"
      style={{
        margin: "12px 0",
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid rgba(220, 38, 38, 0.45)",
        background: "rgba(220, 38, 38, 0.12)",
        color: "#fecaca",
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>
        Seed / dummy data detected{isProductionRuntime() ? " in production" : ""} ({total} row{total === 1 ? "" : "s"})
      </div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {findings.map((f) => (
          <li key={f.table}>
            <strong>{f.table}</strong>: {f.count} flagged — e.g. {f.sample}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 6, opacity: 0.85 }}>
        Review and delete these records from the backend before they reach end users.
      </div>
    </div>
  );
}