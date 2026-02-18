"use client"

import * as React from "react"
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

// This can be used by components calling toast()
export type Toast = Omit<ToasterToast, "id" | "open" | "onOpenChange">

// Internal state representation of a toast
export type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

// Context type
type ToastContextType = {
  toasts: ToasterToast[]
  toast: (props: Toast) => void
  dismiss: (toastId: string) => void
}

export const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

// Hook to use the toast context
export function useToast() {
  const context = React.useContext(ToastContext)
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastStateProvider")
  }
  return context
}
