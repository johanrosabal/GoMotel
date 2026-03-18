'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import type { Room } from "@/types";
import { Skeleton } from "../ui/skeleton";
import { Button } from "../ui/button";
import { Check, Clock, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useTransition, useState, useEffect } from "react";
import { updateRoomStatus } from "@/lib/actions/room.actions";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNowStrict, format } from "date-fns";
import { es } from 'date-fns/locale';

function CleaningRoomCard({ room }: { room: Room }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [timeInStatus, setTimeInStatus] = useState('');

    useEffect(() => {
        let intervalId: NodeJS.Timeout | undefined;
    
        if (room.status === 'Cleaning' && room.statusUpdatedAt) {
          const update = () => {
            setTimeInStatus(formatDistanceToNowStrict(room.statusUpdatedAt.toDate(), { locale: es, addSuffix: true }));
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
                toast({ title: 'Éxito', description: `La habitación ${room.number} ahora está disponible.` });
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Habitación {room.number}</CardTitle>
                    <div className="text-sm text-muted-foreground flex items-center gap-1" title={room.statusUpdatedAt ? 'Inició ' + format(room.statusUpdatedAt.toDate(), "dd MMM yyyy, h:mm a", { locale: es }) : ''}>
                        <Clock className="h-4 w-4" />
                        {timeInStatus || 'Calculando...'}
                    </div>
                </div>
                <CardDescription>{room.roomTypeName}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button className="w-full" onClick={handleSetAvailable} disabled={isPending} id="cleaningqueuepage-button-1">
                    <Check className="mr-2 h-4 w-4" />
                    {isPending ? 'Actualizando...' : 'Marcar como Disponible'}
                </Button>
            </CardContent>
        </Card>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-40 w-full" />
                ))}
            </div>
        )
    }

    if (!cleaningRooms || cleaningRooms.length === 0) {
        return (
            <div className="text-center py-16 border-2 border-dashed rounded-lg flex flex-col items-center gap-4">
              <Sparkles className="h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium text-muted-foreground">¡Todo Limpio!</h3>
              <p className="text-sm text-muted-foreground">
                No hay habitaciones en la cola de limpieza en este momento.
              </p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {cleaningRooms.map(room => (
                <CleaningRoomCard key={room.id} room={room} />
            ))}
        </div>
    );
}
