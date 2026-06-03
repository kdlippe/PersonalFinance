'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NetWorthSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to Settings page
    router.replace('/settings');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Redirecting to Settings...</p>
      </div>
    </div>
  );
}
