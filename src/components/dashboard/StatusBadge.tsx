import { Badge } from '@/components/ui/badge';
import type { RoomStatus } from '@/types';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface StatusBadgeProps {
  status: RoomStatus;
  className?: string;
  isOverdue?: boolean;
}

const statusStyles: Record<RoomStatus, string> = {
  Available: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50',
  Occupied: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50',
  Cleaning: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/50',
  Maintenance: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/50',
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
            variant="destructive"
            className={cn('font-semibold', className)}
          >
            <AlertTriangle className="h-3 w-3 mr-1.5" />
            Vencida
          </Badge>
      )
  }

  return (
    <Badge
      variant="outline"
      className={cn('font-semibold', statusStyles[status], className)}
    >
      {statusMap[status] || status}
    </Badge>
  );
}
