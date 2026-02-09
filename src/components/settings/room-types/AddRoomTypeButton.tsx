'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import EditRoomTypeDialog from './EditRoomTypeDialog';

export default function AddRoomTypeButton() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <Button size="sm" disabled>
        <PlusCircle className="mr-2 h-4 w-4" />
        Añadir Tipo de Habitación
      </Button>
    );
  }

  return (
    <EditRoomTypeDialog>
        <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Tipo de Habitación
        </Button>
    </EditRoomTypeDialog>
  );
}
