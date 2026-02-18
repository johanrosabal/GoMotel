'use client';

import { useState } from 'react';
import type { Room } from '@/types';
import { MoreHorizontal, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import AddRoomDialog from './AddRoomDialog';

export default function RoomActionsMenu({ room }: { room: Room }) {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    // Stop propagation to prevent link navigation
    const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleInteraction}>
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Abrir menú de habitación</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={handleInteraction}>
                    <DropdownMenuLabel>Acciones de Habitación</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar Habitación
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AddRoomDialog room={room} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />
        </>
    );
}
