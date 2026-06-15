'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import type { Room } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AddRoomDialog from './AddRoomDialog';
import { cn } from '@/lib/utils';

interface EditRoomTopButtonProps {
    rooms: Room[];
}

export default function EditRoomTopButton({ rooms }: EditRoomTopButtonProps) {
    const [open, setOpen] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const selectedRoom = rooms.find(r => r.id === selectedRoomId);

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="secondary" className="rounded-full font-black uppercase tracking-widest text-[10px] h-11 px-6 border border-white/10 shadow-xl">
                        <Edit className="mr-2 h-4 w-4 text-primary" />
                        Editar Habitación
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-slate-950/95 backdrop-blur-xl border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Editar Habitación</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Seleccione la habitación que desea editar.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <Select onValueChange={(value) => setSelectedRoomId(value)}>
                            <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl text-white">
                                <SelectValue placeholder="Seleccione habitación" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 text-white">
                                {rooms.slice().sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })).map((room) => (
                                    <SelectItem key={room.id} value={room.id} className="py-3 focus:bg-white/5 cursor-pointer">
                                        <div className="flex items-center justify-between w-full gap-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl font-black text-white italic tracking-tighter">{room.number}</span>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Habitación</span>
                                                    <span className="text-xs font-bold text-slate-300">{room.roomTypeName}</span>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "h-2 w-2 rounded-full",
                                                room.status === 'Available' ? "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]" :
                                                room.status === 'Occupied' ? "bg-violet-500 shadow-[0_0_8px_rgba(167,139,250,0.5)]" :
                                                room.status === 'Cleaning' ? "bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.5)]" :
                                                "bg-fuchsia-500 shadow-[0_0_8px_rgba(232,121,249,0.5)]"
                                            )} />
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button
                            disabled={!selectedRoomId}
                            onClick={() => {
                                setOpen(false);
                                setIsEditDialogOpen(true);
                            }}
                            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-xs"
                        >
                            Continuar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {selectedRoom && (
                <AddRoomDialog room={selectedRoom} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />
            )}
        </>
    );
}
