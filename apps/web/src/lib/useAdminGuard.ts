'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from './adminApi';

// Client-side only -- there's no server-side session to check (the token
// lives in localStorage, read at request time by adminApi's fetch calls).
// This just prevents rendering an admin page's content before we know
// whether a token exists at all; the real enforcement is the API's 401 on
// every protected request, handled per-page by catching UnauthorizedError.
export function useAdminGuard() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/admin/login');
    } else {
      setChecked(true);
    }
  }, [router]);

  return checked;
}
