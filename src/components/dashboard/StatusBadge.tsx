import { Badge } from '@/components/ui/badge';
import type { RoomStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: RoomStatus;
  className?: string;
}

const statusStyles: Record<RoomStatus, string> = {
  Available: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50',
  Occupied: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50',
  Cleaning: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50',
  Maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/50',
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('font-semibold', statusStyles[status], className)}
    >
      {status}
    </Badge>
  );
}
