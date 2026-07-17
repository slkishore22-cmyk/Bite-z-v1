const SESSION_KEY = 'bitez_user_session';
const SELLER_KEY = 'bitez_seller_session';
const ADMIN_KEY = 'bitez_admin_session';
const USER_ID_KEY = 'bitez_user_id';

function writeSession(key, value) {
  const str = JSON.stringify(value);
  try { localStorage.setItem(key, str); } catch (_) {}
  try { sessionStorage.setItem(key, str); } catch (_) {}
}

function readSession(key) {
  try {
    const v = localStorage.getItem(key);
    if (v) return JSON.parse(v);
  } catch (_) {}
  try {
    const v = sessionStorage.getItem(key);
    if (v) {
      try { localStorage.setItem(key, v); } catch (_) {}
      return JSON.parse(v);
    }
  } catch (_) {}
  return null;
}

function removeSession(key) {
  try { localStorage.removeItem(key); } catch (_) {}
  try { sessionStorage.removeItem(key); } catch (_) {}
}

function dispatchSessionChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bitez:session:change"));
  }
}

export function saveUserSession(data) {
  writeSession(SESSION_KEY, { ...data, role: 'user', savedAt: Date.now() });
  if (data?.user_id) {
    try { localStorage.setItem(USER_ID_KEY, data.user_id); } catch (_) {}
    try { sessionStorage.setItem(USER_ID_KEY, data.user_id); } catch (_) {}
  }
  dispatchSessionChange();
}

export function getUserSession() {
  return readSession(SESSION_KEY);
}

export function clearUserSession() {
  removeSession(SESSION_KEY);
  dispatchSessionChange();
}

export function saveSellerSession(data) {
  writeSession(SELLER_KEY, { ...data, role: 'seller', savedAt: Date.now() });
  dispatchSessionChange();
}

export function getSellerSession() {
  return readSession(SELLER_KEY);
}

export function clearSellerSession() {
  removeSession(SELLER_KEY);
  dispatchSessionChange();
}

export function saveAdminSession(data) {
  // Always overwrite any previous admin session so two different master-admin
  // accounts can never overlap on the same device.
  removeSession(ADMIN_KEY);
  const username =
    typeof data === 'string' ? data : (data && data.username) || '';
  writeSession(ADMIN_KEY, {
    role: 'master_admin',
    authenticated: true,
    username,
    savedAt: Date.now(),
  });
  dispatchSessionChange();
}

export function getAdminSession() {
  const s = readSession(ADMIN_KEY);
  if (!s) return null;
  if (Date.now() - s.savedAt > 8 * 60 * 60 * 1000) {
    removeSession(ADMIN_KEY);
    dispatchSessionChange();
    return null;
  }
  return s;
}

export function clearAdminSession() {
  removeSession(ADMIN_KEY);
  dispatchSessionChange();
}

export function getActiveSession() {
  if (getAdminSession()) return { role: 'master_admin' };
  if (getSellerSession()) return { role: 'seller' };
  if (getUserSession()) return { role: 'user' };
  return null;
}

export function getUserName() {
  const s = getUserSession();
  if (!s) return 'there';
  const name = s.full_name || s.name || '';
  return name ? name.split(' ')[0] : 'there';
}
