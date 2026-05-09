'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { WifiOff, Loader2 } from 'lucide-react';

export default function NetworkStatusModal() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Interceptar console.error para atrapar errores internos de Firebase
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const msg = typeof args[0] === 'string' ? args.join(' ') : JSON.stringify(args);
      if (
        msg.includes('Could not reach Cloud Firestore backend') ||
        msg.includes('auth/network-request-failed') ||
        msg.includes('code=unavailable') ||
        msg.includes('offline mode')
      ) {
        setIsOnline(false);
      }
      originalConsoleError.apply(console, args);
    };

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      console.error = originalConsoleError;
    };
  }, []);

  // Poll for connection recovery when offline
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (!isOnline) {
      interval = setInterval(async () => {
        try {
          // Intentar hacer fetch a un recurso ligero
          const response = await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store' });
          if (response.ok) {
            setIsOnline(true);
          }
        } catch (error) {
          // Aún sin conexión
        }
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOnline]);

  // Only render on client to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <Dialog open={!isOnline} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md [&>button]:hidden bg-slate-950 border-slate-800"
        onInteractOutside={(e) => e.preventDefault()} 
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
            <WifiOff className="h-6 w-6 text-red-500" />
          </div>
          <DialogTitle className="text-center text-xl font-bold text-slate-200">
            Error de Conexión
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400 space-y-4">
            <p>
              No se pudo establecer conexión con el servidor de la base de datos (Firebase).
            </p>
            <p>
              Por favor, verifica tu conexión a internet o red local. El sistema funcionará en modo offline limitado y se sincronizará automáticamente cuando regrese la conexión.
            </p>
            <div className="flex items-center justify-center gap-2 text-amber-500 text-sm font-medium pt-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Esperando conexión...
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
