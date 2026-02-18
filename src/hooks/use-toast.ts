'use client';

import * as React from 'react';
import type { ToastActionElement, ToastProps } from '@/components/ui/toast';

export type Toast = Omit<ToasterToast, 'id' | 'open' | 'onOpenChange'> & { id?: string };

export type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type ToastContextType = {
  toasts: ToasterToast[];
  toast: (props: Toast) => void;
  dismiss: (toastId: string) => void;
};

export const ToastContext = React.createContext<ToastContextType | undefined>(
  undefined
);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastStateProvider');
  }
  return context;
}
