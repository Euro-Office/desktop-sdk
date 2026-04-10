/**
 * Pluggable key-value settings adapter.
 * Host applications provide their own implementation (e.g. localStorage, AsyncStorage, etc.).
 * The library accesses settings only through this interface.
 */
export interface SettingsAdapter {
  /** Read a value by key. Returns null if key does not exist */
  get(key: string): string | null;

  /** Write a value by key */
  set(key: string, value: string): void;

  /** Remove a key and its value */
  remove(key: string): void;
}
