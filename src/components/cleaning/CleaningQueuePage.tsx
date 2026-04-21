'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import type { Room } from "@/types";
import { Skeleton } from "../ui/skeleton";
import { Button } from "../ui/button";
import { Check, Clock, Sparkles, Zap, Brush } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useTransition, useState, useEffect } from "react";
import { updateRoomStatus } from "@/lib/actions/room.actions";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNowStrict, format } from "date-fns";
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";

function CleaningRoomCard({ room }: { room: Room }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [timeInStatus, setTimeInStatus] = useState('');

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


    const handleSetAvailable = () => {
        startTransition(async () => {
            const result = await updateRoomStatus(room.id, 'Available');
            if (result.success) {
                toast({ title: 'Habitación Lista', description: `La suite ${room.number} ha sido marcada como disponible.` });
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }

    return (
        <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.02, y: -4 }}
            className="group/card"
        >
            <Card className={cn(
                "relative transition-all duration-300 flex flex-col h-full overflow-hidden truncate",
                "bg-slate-950/40 backdrop-blur-2xl border border-white/10",
                "rounded-[2rem] shadow-2xl shadow-black/50 overflow-hidden",
                "border-amber-500/30 shadow-[0_0_20px_-5px_rgba(251,191,36,0.2)] hover:shadow-[0_0_30px_-5px_rgba(251,191,36,0.4)]"
            )}>
                {/* Subtle status glow band */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-30" />
                
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4 p-6 shrink-0">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-4xl font-black uppercase italic tracking-tighter text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                                {room.number}
                            </CardTitle>
                            <Zap className="h-4 w-4 fill-amber-400 text-amber-400 opacity-30" />
                        </div>
                        <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 !mt-0">{room.roomTypeName}</CardDescription>
                    </div>
                    <div className="p-2 rounded-xl bg-white/5 border border-white/5 text-amber-400">
                        <Brush className="h-5 w-5" />
                    </div>
                </CardHeader>

                <CardContent className="mt-auto space-y-4 p-6 pt-0">
                    <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.1)]">
                            <Clock className="h-3 w-3" />
                            <span className="text-[9px] font-black uppercase tracking-widest">{timeInStatus || 'Iniciando'}</span>
                        </div>
                    </div>

                    <Button 
                        className="w-full h-10 font-black uppercase tracking-widest text-[9px] bg-amber-500 text-black hover:bg-amber-400 transition-all rounded-xl shadow-lg shadow-amber-500/20 active:scale-95" 
                        onClick={handleSetAvailable} 
                        disabled={isPending}
                        id="cleaningroomcard-button-finalizar"
                        data-testid="cleaningroomcard-finish-button"
                    >
                        <Check className="mr-2 h-4 w-4" />
                        {isPending ? 'Procesando...' : 'Finalizar Limpieza'}
                    </Button>
                </CardContent>
            </Card>
        </motion.div>
    )
}

export default function CleaningQueuePage() {
    const { firestore } = useFirebase();

    const cleaningRoomsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, "rooms"),
            where('status', '==', 'Cleaning'),
            orderBy('statusUpdatedAt', 'asc') // Oldest first
        );
    }, [firestore]);

    const { data: cleaningRooms, isLoading } = useCollection<Room>(cleaningRoomsQuery);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-52 rounded-[2rem] bg-white/5 animate-pulse border border-white/10" />
                ))}
            </div>
        )
    }

    if (!cleaningRooms || cleaningRooms.length === 0) {
        return (
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20 bg-black/20 backdrop-blur-sm rounded-[2.5rem] border border-white/5 flex flex-col items-center gap-6"
            >
                <div className="relative">
                    <div className="absolute inset-0 blur-3xl bg-amber-500/20 animate-pulse" />
                    <Sparkles className="h-16 w-16 text-amber-400 relative z-10" />
                </div>
                <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-200">¡Todo Impecable!</h3>
                    <p className="text-slate-500 mt-2 font-medium">
                        No hay suites pendientes en la cola de limpieza actual.
                    </p>
                </div>
                <div className="h-1 w-24 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent rounded-full" />
            </motion.div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
                {cleaningRooms.map(room => (
                    <CleaningRoomCard key={room.id} room={room} />
                ))}
            </AnimatePresence>
        </div>
    );
}
