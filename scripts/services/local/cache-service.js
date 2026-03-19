export function setCache(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getCache(key, fallback = null) {
  const value = localStorage.getItem(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
