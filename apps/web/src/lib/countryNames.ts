// CR-2026-11-16-11: French country names on French pages (owner, 11-16: "everything should be in french"). The countries
// table stores English names; the ISO code gives the French one through the runtime's ICU data. Falls back to the stored
// name for an unknown code.
let fr: Intl.DisplayNames | null = null;
try {
  fr = new Intl.DisplayNames(['fr'], { type: 'region' });
} catch {
  fr = null;
}

export function frCountry(iso: string | null | undefined, fallback?: string | null): string {
  const code = (iso || '').trim().toUpperCase();
  if (fr && /^[A-Z]{2}$/.test(code)) {
    try {
      const name = fr.of(code);
      if (name && name !== code) return name;
    } catch {
      // unknown code: fall through
    }
  }
  return fallback || code;
}
