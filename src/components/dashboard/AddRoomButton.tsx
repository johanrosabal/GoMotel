'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import AddRoomDialog from './AddRoomDialog';

export default function AddRoomButton() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <Button size="sm" disabled id="addroombutton-button-a-adir-habitaci-n">
        <PlusCircle className="mr-2 h-4 w-4" />
        Añadir Habitación
      </Button>
    );
  }

  return (
    <AddRoomDialog>
        <Button size="sm" id="addroombutton-button-a-adir-habitaci-n-1">
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Habitación
        </Button>
    </AddRoomDialog>
  );
}
