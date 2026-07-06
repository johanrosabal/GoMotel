'use client';

import React, { useState, useTransition, type ReactNode, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Room, Stay } from '@/types';
import { reassignRoom } from '@/lib/actions/room.actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeftRight, RefreshCw, AlertTriangle } from 'lucide-react';

interface ReassignRoomDialogProps {
    children: ReactNode;
    stay: Stay | null | undefined;
    room: Room;
}

export default function ReassignRoomDialog({ children, stay, room }: ReassignRoomDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const router = useRouter();
    const [targetRoomId, setTargetRoomId] = useState<string>('');

    // Query for rooms in 'Available' state
    const roomsQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, "rooms"), where('status', '==', 'Available')) : null,
        [firestore]
    );
    const { data: availableRooms, isLoading: isLoadingRooms } = useCollection<Room>(roomsQuery);

    // Filter and sort available rooms
    const sortedRooms = useMemo(() => {
        if (!availableRooms) return [];
        return [...availableRooms]
            .filter(r => r.id !== room.id)
            .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    }, [availableRooms, room.id]);

    // Reset selection when opening/closing
    useEffect(() => {
        if (!open) {
            setTargetRoomId('');
        }
    }, [open]);

    const handleReassign = () => {
        if (!stay || !targetRoomId) return;

        startTransition(async () => {
            const result = await reassignRoom(stay.id, room.id, targetRoomId);

            if (result.error) {
                toast({
                    title: 'Error de reasignación',
                    description: result.error,
                    variant: 'destructive',
                });
            } else {
                toast({
                    title: '¡Traslado completado!',
                    description: 'El huésped ha sido reasignado de habitación exitosamente.',
                });
                setOpen(false);
                // Redirect to the new room details page
                router.push(`/rooms/${targetRoomId}`);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-md p-0 border-none bg-slate-950/60 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2.5rem]">
                <div className="relative overflow-hidden p-8">
                    {/* Decorative background glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary rounded-full blur-[80px] opacity-10 pointer-events-none" />

                    <DialogHeader className="mb-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 shadow-inner text-primary">
                                <ArrowLeftRight className="h-6 w-6" />
                            </div>
                            <DialogTitle className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-white">
                                Reasignar Habitación
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-slate-400 font-medium">
                            Traslada al huésped a otra habitación disponible.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                Habitación de Destino
                            </label>
                            {isLoadingRooms ? (
                                <div className="h-12 w-full bg-white/5 border border-white/5 rounded-2xl animate-pulse flex items-center px-4">
                                    <span className="text-xs text-slate-500">Cargando habitaciones disponibles...</span>
                                </div>
                            ) : sortedRooms.length === 0 ? (
                                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3">
                                    <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
                                    <p className="text-xs text-rose-400 font-medium">
                                        No hay otras habitaciones disponibles en este momento.
                                    </p>
                                </div>
                            ) : (
                                <Select value={targetRoomId} onValueChange={setTargetRoomId}>
                                    <SelectTrigger className="w-full h-12 bg-white/5 border-white/10 text-white rounded-2xl focus:ring-primary">
                                        <SelectValue placeholder="Seleccione una habitación..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl">
                                        {sortedRooms.map((r) => (
                                            <SelectItem key={r.id} value={r.id} className="focus:bg-primary focus:text-white rounded-lg cursor-pointer">
                                                Habitación {r.number} — {r.roomTypeName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {targetRoomId && stay && (
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-3 text-xs">
                                <p className="font-bold text-slate-300">Confirmación de Traslado:</p>
                                <div className="space-y-1 text-slate-400 leading-relaxed">
                                    <p>
                                        <strong>Huésped:</strong> {stay.guestName}
                                    </p>
                                    <p>
                                        <strong>Habitación actual:</strong> {room.number}
                                    </p>
                                    <p>
                                        <strong>Nueva Habitación:</strong> <span className="text-primary font-bold">{sortedRooms.find(r => r.id === targetRoomId)?.number}</span>
                                    </p>
                                </div>
                                <div className="pt-2 border-t border-white/5 text-[10px] text-slate-500 italic space-y-1">
                                    <p>* La cuenta y consumos se transferirán a la nueva habitación.</p>
                                    <p>* La habitación actual ({room.number}) quedará en estado "Disponible".</p>
                                </div>
                            </div>
                        )}

                        <DialogFooter className="pt-4 gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                className="rounded-2xl h-12 px-6 border-white/10 text-white hover:bg-white/5"
                                disabled={isPending}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleReassign}
                                className="rounded-2xl h-12 px-6 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                                disabled={!targetRoomId || isPending || !stay}
                            >
                                {isPending ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Reasignando...
                                    </>
                                ) : (
                                    'Confirmar Reasignación'
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
