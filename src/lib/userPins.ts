// Local-first store for menu personalization:
// - "pinned" items: anything the user tapped (added to cart) or ordered.
//   These float to the top of the menu list, most recent first.
// - "favorites": items the user explicitly hearted via swipe action.
//   Favorites always pin above regular pinned items.

const PIN_KEY = "bitez:user:pinned";
const FAV_KEY = "bitez:user:favorites";
const EVENT_NAME = "bitez:user:pins:change";

type PinMap = Record<string, number>; // itemId -> timestamp

function readMap(key: string): PinMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as PinMap) : {};
  } catch {
    return {};
  }
}

function writeMap(key: string, map: PinMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function getPinned(): PinMap {
  return readMap(PIN_KEY);
}

export function pinItem(itemId: string) {
  const map = readMap(PIN_KEY);
  map[itemId] = Date.now();
  writeMap(PIN_KEY, map);
}

export function getFavorites(): PinMap {
  return readMap(FAV_KEY);
}

export function isFavorite(itemId: string): boolean {
  return Boolean(readMap(FAV_KEY)[itemId]);
}

export function toggleFavorite(itemId: string) {
  const map = readMap(FAV_KEY);
  if (map[itemId]) delete map[itemId];
  else map[itemId] = Date.now();
  writeMap(FAV_KEY, map);
}

export function subscribePins(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === PIN_KEY || e.key === FAV_KEY) cb();
  };
  window.addEventListener(EVENT_NAME, onLocal as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onLocal as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}