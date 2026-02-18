'use client';

import * as React from 'react';
import {
  ToastContext,
  type Toast,
  type ToasterToast,
} from '@/hooks/use-toast';

export function ToastStateProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToasterToast[]>([]);

  const dismiss = React.useCallback((toastId: string) => {
    setToasts((prevToasts) => prevToasts.filter((t) => t.id !== toastId));
  }, []);

  const toast = React.useCallback(
    (props: Toast) => {
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
      setToasts((prevToasts) => [newToast, ...prevToasts]);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}
