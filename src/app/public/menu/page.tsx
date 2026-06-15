'use client';

import PublicMenuClient from '@/components/public/PublicMenuClient';
import { getSystemSettings } from '@/lib/actions/system.actions';
import { useState, useEffect } from 'react';

export default function PublicMenuPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSystemSettings().then(settings => {
      setIsDarkMode(settings.publicMenuDarkMode);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">Cargando...</div>;

  return <PublicMenuClient isDarkMode={isDarkMode} />;
}
