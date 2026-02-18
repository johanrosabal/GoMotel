'use client';

import React, { useState, useCallback } from 'react';
import { ToastContext, type Toast, type ToasterToast } from '@/hooks/use-toast';

export function ToastStateProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToasterToast[]>([]);

  const dismiss = useCallback((toastId: string) => {
    setToasts((currentToasts) =>
      currentToasts.filter((t) => t.id !== toastId)
    );
  }, []);

  const toast = useCallback(
    ({ ...props }: Toast) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToasterToast = {
        id,
        ...props,
        open: true,
        onOpenChange: (open) => {
          if (!open) {
            dismiss(id);
          }
        },
      };

      setToasts((currentToasts) => [newToast, ...currentToasts]);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}
