'use client';

import { useState } from 'react';
import type { Room } from '@/types';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AddRoomDialog from './AddRoomDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function RoomActionsMenu({ room }: { room: Room }) {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    // Stop propagation to prevent link navigation
    const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }

    return (
        <>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl hover:bg-primary/20 hover:border-primary/50 text-white transition-all group" 
                            onClick={(e) => {
                                handleInteraction(e);
                                setIsEditDialogOpen(true);
                            }} 
                            id="roomcard-edit-button"
                        >
                            <Edit className="h-5 w-5 text-slate-300 group-hover:text-primary transition-colors" />
                            <span className="sr-only">Editar habitación</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-slate-900 border-white/10 text-white font-bold uppercase tracking-widest text-[10px]">
                        Editar Habitación
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <AddRoomDialog room={room} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />
        </>
    );
}
