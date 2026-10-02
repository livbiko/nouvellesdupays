'use client';

import { openConsentSettings } from '@/lib/tracking';

export default function ConsentSettingsButton() {
  return (
    <button type="button" onClick={openConsentSettings} className="rounded-md border border-neutral-600 hover:border-neutral-400 px-4 py-2 text-neutral-100">
      Gérer mes préférences cookies
    </button>
  );
}
