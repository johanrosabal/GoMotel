'use client';

import { useState, useEffect } from 'react';
import { formatDistanceStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ReservationStatus } from '@/types';
import { cn } from '@/lib/utils';

interface TimeRemainingProps {
  checkOutDate: Date;
  status: ReservationStatus;
  className?: string;
}

export default function TimeRemaining({ checkOutDate, status, className }: TimeRemainingProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (status !== 'Checked-in') return;

    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [status]);

  if (status !== 'Checked-in') {
    return <span className={cn("text-muted-foreground", className)}>-</span>;
  }

  const isOverdue = now > checkOutDate;

  if (isOverdue) {
    return (
      <span className={cn("font-semibold text-destructive", className)}>
        Vencido
      </span>
    );
  }

  const distance = formatDistanceStrict(checkOutDate, now, { locale: es, addSuffix: false });
  return <span className={cn("font-medium", className)}>{distance}</span>;
}
