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
      <Button disabled className="rounded-full bg-primary/20 text-slate-500 font-black uppercase tracking-widest text-[10px] h-12 px-8 border border-white/5" id="addroombutton-button-a-adir-habitaci-n" data-testid="addroombutton-add-button">
        <PlusCircle className="mr-2 h-5 w-5" />
        Añadir Habitación
      </Button>
    );
  }

  return (
    <AddRoomDialog>
        <Button className="rounded-full bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-widest text-[10px] h-12 px-8 shadow-xl shadow-primary/20 transition-all active:scale-95 hover:scale-105" id="addroombutton-button-a-adir-habitaci-n-1" data-testid="addroombutton-add-button">
            <PlusCircle className="mr-2 h-5 w-5" />
            Añadir Habitación
        </Button>
    </AddRoomDialog>
  );
}
