function browserStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

export function getItem(key: string): Promise<string | null> {
  return Promise.resolve(browserStorage()?.getItem(key) ?? null);
}

export function setItem(key: string, value: string): Promise<void> {
  browserStorage()?.setItem(key, value);
  return Promise.resolve();
}

export function deleteItem(key: string): Promise<void> {
  browserStorage()?.removeItem(key);
  return Promise.resolve();
}
