'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

// Root page: decides where to send the user — to login or to the dashboard.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getToken() ? '/dashboard' : '/login');
  }, [router]);

  return (
    <main className="flex h-screen items-center justify-center text-slate-400">
      Loading…
    </main>
  );
}
