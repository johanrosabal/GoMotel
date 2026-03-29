import { Badge } from '@/components/ui/badge';
import type { RoomStatus } from '@/types';
import { cn } from '@/lib/utils';
import { AlertTriangle, Circle } from 'lucide-react';

interface StatusBadgeProps {
  status: RoomStatus;
  className?: string;
  isOverdue?: boolean;
}

const statusStyles: Record<RoomStatus, string> = {
  Available: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]',
  Occupied: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]',
  Cleaning: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(251,191,36,0.1)]',
  Maintenance: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20 shadow-[0_0_10px_rgba(232,121,249,0.1)]',
};

const statusMap: Record<RoomStatus, string> = {
  Available: 'Disponible',
  Occupied: 'Ocupada',
  Cleaning: 'Limpieza',
  Maintenance: 'Mantenimiento',
};

export default function StatusBadge({ status, className, isOverdue = false }: StatusBadgeProps) {
  if (isOverdue) {
      return (
          <Badge
            variant="outline"
            className={cn(
              'font-black uppercase tracking-widest text-[9px] px-3 py-1 rounded-full',
              'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse shadow-[0_0_15px_rgba(251,113,133,0.3)]',
              className
            )}
          >
            <AlertTriangle className="h-3 w-3 mr-1.5" />
            Vencida
          </Badge>
      )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-black uppercase tracking-widest text-[9px] px-3 py-1 rounded-full items-center gap-1.5',
        statusStyles[status],
        className
      )}
    >
      <Circle className="h-1.5 w-1.5 fill-current animate-pulse" />
      {statusMap[status] || status}
    </Badge>
  );
}
