// Shared local store for seller staff. Persists to localStorage and broadcasts
// changes (same tab + cross-tab) so any consumer stays in sync without a backend.

export type StaffMember = {
  id: string;
  name: string;
  staffId: string;
  password: string;
  createdAt: number;
};

const STORAGE_KEY = "bitez:seller:staff";
const EVENT_NAME = "bitez:seller:staff:change";

function read(): StaffMember[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StaffMember[]) : [];
  } catch {
    return [];
  }
}

function write(items: StaffMember[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function getStaff(): StaffMember[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

export function addStaff(input: Omit<StaffMember, "id" | "createdAt">): StaffMember {
  const newMember: StaffMember = {
    ...input,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `stf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  write([newMember, ...read()]);
  return newMember;
}

export function removeStaff(id: string) {
  write(read().filter((m) => m.id !== id));
}

export function nextStaffToken(): string {
  const n = read().length + 1;
  return `token_${String(n).padStart(2, "0")}`;
}

export function subscribeStaff(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener(EVENT_NAME, onLocal as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onLocal as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
