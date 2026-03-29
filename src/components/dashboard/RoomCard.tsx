'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import StatusBadge from './StatusBadge';
import type { Room, Stay } from '@/types';
import { BedDouble, Sparkles, Wrench, User, AlertTriangle, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUserProfile } from '@/hooks/use-user-profile';
import RoomActionsMenu from './RoomActionsMenu';
import { Progress } from '../ui/progress';
import TimeRemaining from '../reservations/TimeRemaining';
import { Button } from '../ui/button';
import { motion } from 'framer-motion';

interface RoomCardProps {
  room: Room;
  stay?: Stay;
  isOverdue?: boolean;
}

const statusConfig = {
    Available: { 
      icon: BedDouble, 
      color: 'text-emerald-400', 
      glow: 'shadow-[0_0_20px_-5px_rgba(52,211,153,0.3)]',
      hoverGlow: 'group-hover/card:shadow-[0_0_30px_-5px_rgba(52,211,153,0.5)]',
      border: 'border-emerald-500/30'
    },
    Occupied: { 
      icon: User, 
      color: 'text-cyan-400', 
      glow: 'shadow-[0_0_20px_-5px_rgba(34,211,238,0.3)]',
      hoverGlow: 'group-hover/card:shadow-[0_0_30px_-5px_rgba(34,211,238,0.5)]',
      border: 'border-cyan-500/30'
    },
    Cleaning: { 
      icon: Sparkles, 
      color: 'text-amber-400', 
      glow: 'shadow-[0_0_20px_-5px_rgba(251,191,36,0.3)]',
      hoverGlow: 'group-hover/card:shadow-[0_0_30px_-5px_rgba(251,191,36,0.5)]',
      border: 'border-amber-500/30'
    },
    Maintenance: { 
      icon: Wrench, 
      color: 'text-fuchsia-400', 
      glow: 'shadow-[0_0_20px_-5px_rgba(232,121,249,0.3)]',
      hoverGlow: 'group-hover/card:shadow-[0_0_30px_-5px_rgba(232,121,249,0.5)]',
      border: 'border-fuchsia-500/30'
    },
    Overdue: { 
      icon: AlertTriangle, 
      color: 'text-rose-400', 
      glow: 'shadow-[0_0_25px_-5px_rgba(251,113,133,0.4)]',
      hoverGlow: 'group-hover/card:shadow-[0_0_35px_-5px_rgba(251,113,133,0.6)]',
      border: 'border-rose-500/40'
    }
}

export default function RoomCard({ room, stay, isOverdue = false }: RoomCardProps) {
  const { userProfile } = useUserProfile();
  const currentStatus = isOverdue ? 'Overdue' : room.status;
  const { icon: Icon, color, glow, hoverGlow, border } = statusConfig[currentStatus];
  
  const [timeInStatus, setTimeInStatus] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (room.status === 'Cleaning' && room.statusUpdatedAt) {
      const update = () => {
        setTimeInStatus(formatDistanceToNowStrict(room.statusUpdatedAt.toDate(), { locale: es }));
      };
      update();
      intervalId = setInterval(update, 60000); // update every minute
    } else {
        setTimeInStatus('');
    }

    return () => clearInterval(intervalId);
  }, [room.status, room.statusUpdatedAt]);

  useEffect(() => {
    if (!stay || room.status !== 'Occupied') {
      setProgress(0);
      return;
    }

    const calculateProgress = () => {
      const now = new Date();
      const checkInTime = stay.checkIn.toDate();
      const expectedCheckOutTime = stay.expectedCheckOut.toDate();

      if (now >= expectedCheckOutTime) {
        setProgress(100);
        return;
      }
      if (now < checkInTime) {
        setProgress(0);
        return;
      }

      const totalDuration = expectedCheckOutTime.getTime() - checkInTime.getTime();
      const elapsedTime = now.getTime() - checkInTime.getTime();
      
      const calculatedProgress = (elapsedTime / totalDuration) * 100;
      setProgress(Math.min(100, calculatedProgress));
    };

    calculateProgress();
    const interval = setInterval(calculateProgress, 60000); // Update every minute
    return () => clearInterval(interval);

  }, [stay, room.status]);

  return (
    <motion.div 
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
      className="relative group/card h-full"
    >
      {userProfile?.role === 'Administrador' && (
          <div className="absolute top-5 right-[4.5rem] z-20 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <RoomActionsMenu room={room} />
          </div>
      )}
      <Link href={`/rooms/${room.id}`} className="block h-full" id="roomcard-link-1">
        <Card className={cn(
          "relative transition-all duration-300 flex flex-col h-full overflow-hidden",
          "bg-slate-950/40 backdrop-blur-2xl border border-white/10",
          "rounded-[2rem] shadow-2xl shadow-black/50",
          glow, hoverGlow, border,
          isOverdue && "animate-pulse border-rose-500/50"
        )}>
          {/* Subtle status glow band */}
          <div className={cn("absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-30", color)} />
          
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4 p-6">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className={cn(
                    "text-4xl font-black uppercase italic tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-all",
                    color, "group-hover/card:drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                  )}>
                    {room.number}
                  </CardTitle>
                  <Zap className={cn("h-4 w-4 animate-pulse fill-current opacity-20", color)} />
                </div>
                <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 !mt-0">{room.roomTypeName || room.type}</CardDescription>
            </div>
            <div className={cn("p-2 rounded-xl bg-white/5 border border-white/5", color)}>
              <Icon className="h-5 w-5" />
            </div>
          </CardHeader>

          <CardContent className="mt-auto space-y-4 p-6 pt-0">
            {room.status === 'Occupied' && stay ? (
                <div className='space-y-4'>
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                          <StatusBadge status={room.status} isOverdue={isOverdue} />
                          <TimeRemaining 
                              checkOutDate={stay.expectedCheckOut.toDate()} 
                              status={'Checked-in'}
                              className="text-[10px] font-black uppercase tracking-widest text-slate-400"
                          />
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5 border border-white/5">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className={cn("h-full bg-gradient-to-r transition-all", progress > 90 ? "from-rose-500 to-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.5)]" : "from-cyan-500 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]")}
                        />
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" className="w-full h-10 font-black uppercase tracking-widest text-[9px] bg-slate-900/50 border border-white/10 hover:bg-slate-800 transition-all rounded-xl shadow-xl hover:shadow-cyan-500/20" id="roomcard-button-gestionar-estancia">
                      Gestionar Estancia
                    </Button>
                </div>
            ) : (
                <div className="flex justify-between items-center gap-2">
                    <StatusBadge status={room.status} isOverdue={isOverdue} />
                    {room.status === 'Cleaning' && timeInStatus && (
                        <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5" title={`Iniciado el ${room.statusUpdatedAt?.toDate().toLocaleString()}`}>
                          <Clock className="h-3 w-3 text-amber-500" />
                          <span className="uppercase tracking-widest italic">{timeInStatus}</span>
                        </div>
                    )}
                </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
