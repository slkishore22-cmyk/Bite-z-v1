// Runtime guard that detects dummy/seed/sample records and either filters them
// out (in production) or surfaces them as warnings (in development). This is
// the last line of defense against accidentally shipping seed rows that may
// have been inserted while building the app.

export type SeedScanField = string;

export type SeedScanResult<T> = {
  clean: T[];
  flagged: T[];
  reasons: Map<T, string>;
};

// Patterns that strongly indicate a record was created for testing/seeding.
// Keep this conservative — false positives would hide real production data.
const SEED_TEXT_PATTERNS: RegExp[] = [
  /\b(demo|dummy|sample|seed|test\s*seller|test\s*canteen|test\s*user|lorem ipsum|placeholder|do\s*not\s*use)\b/i,
  /\bfoo\s*bar\b/i,
];

const SEED_EMAIL_DOMAINS = ["example.com", "example.org", "test.com", "mailinator.com"];
const SEED_PHONE_VALUES = new Set([
  "0000000000",
  "1111111111",
  "1234567890",
  "9999999999",
  "+910000000000",
]);
const SEED_UUID = "00000000-0000-0000-0000-000000000000";

function valueLooksSeed(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const v = value.trim();
    if (!v) return null;
    if (v === SEED_UUID) return "placeholder UUID";
    if (SEED_PHONE_VALUES.has(v.replace(/\s|-/g, ""))) return "placeholder phone";
    const at = v.lastIndexOf("@");
    if (at >= 0) {
      const domain = v.slice(at + 1).toLowerCase();
      if (SEED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) {
        return `placeholder email domain (${domain})`;
      }
    }
    for (const pat of SEED_TEXT_PATTERNS) {
      if (pat.test(v)) return `matches "${pat.source}"`;
    }
  }
  return null;
}

export function isProductionRuntime(): boolean {
  try {
    if (import.meta.env?.PROD) return true;
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".lovableproject.com")) {
      return false;
    }
    return true;
  }
  return false;
}

export function scanForSeedData<T extends Record<string, unknown>>(
  records: T[] | null | undefined,
  fields: SeedScanField[],
): SeedScanResult<T> {
  const clean: T[] = [];
  const flagged: T[] = [];
  const reasons = new Map<T, string>();
  if (!records) return { clean, flagged, reasons };
  for (const rec of records) {
    let hit: string | null = null;
    for (const f of fields) {
      const r = valueLooksSeed(rec?.[f]);
      if (r) {
        hit = `${f}: ${r}`;
        break;
      }
    }
    if (hit) {
      flagged.push(rec);
      reasons.set(rec, hit);
    } else {
      clean.push(rec);
    }
  }
  return { clean, flagged, reasons };
}

// Convenience: in production, returns only clean records (and logs an error
// once per scan). In dev, returns the original list so engineers can still
// see what they were working on.
export function enforceNoSeedData<T extends Record<string, unknown>>(
  records: T[] | null | undefined,
  fields: SeedScanField[],
  context: string,
): T[] {
  const { clean, flagged, reasons } = scanForSeedData(records, fields);
  if (flagged.length === 0) return records ?? [];
  const summary = flagged.slice(0, 5).map((r) => `• ${reasons.get(r)}`).join("\n");
  if (isProductionRuntime()) {
    console.error(
      `[seedDataGuard] Blocked ${flagged.length} seed-looking row(s) in ${context}:\n${summary}`,
    );
    return clean;
  }
  console.warn(
    `[seedDataGuard] ${flagged.length} seed-looking row(s) in ${context} (allowed in dev):\n${summary}`,
  );
  return records ?? [];
}