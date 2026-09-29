/**
 * Pick a mnemonic character for a menu label (Serenity / Win32 style).
 * Prefers an explicit `mnemonic`, otherwise the first unused A–Z letter in the text.
 */
export function resolveMnemonic(text: string, preferred?: string, used?: Set<string>): string {
  const taken = used ?? new Set<string>();
  const prefer = preferred?.trim();

  if (prefer) {
    const key = prefer.charAt(0).toLowerCase();
    if (/[a-z]/.test(key)) {
      taken.add(key);
      return key;
    }
  }

  for (const ch of text) {
    const key = ch.toLowerCase();
    if (/[a-z]/.test(key) && !taken.has(key)) {
      taken.add(key);
      return key;
    }
  }

  return '';
}

export function splitMnemonic(
  text: string,
  mnemonic: string
): { before: string; mark: string; after: string } | null {
  if (!text || !mnemonic) return null;
  const idx = text.toLowerCase().indexOf(mnemonic.toLowerCase());
  if (idx < 0) return null;
  return {
    before: text.slice(0, idx),
    mark: text.slice(idx, idx + 1),
    after: text.slice(idx + 1),
  };
}
