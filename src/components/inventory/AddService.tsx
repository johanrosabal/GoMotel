'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import EditServiceDialog from './EditServiceDialog';
import type { Service } from '@/types';

interface AddServiceProps {
    allServices: Service[];
}

export default function AddService({ allServices }: AddServiceProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <Button 
        disabled 
        className="bg-gradient-to-r from-primary to-purple-600 text-white rounded-2xl h-11 flex items-center gap-2 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-primary/20 opacity-70"
        id="addservice-button-a-adir-servicio" 
        data-testid="addservice-add-button"
      >
        <PlusCircle className="h-4 w-4" />
        Añadir Producto
      </Button>
    );
  }

  return (
    <EditServiceDialog allServices={allServices}>
        <Button 
          className="bg-gradient-to-r from-primary to-purple-600 text-white hover:from-primary/90 hover:to-purple-600/90 rounded-2xl h-11 flex items-center gap-2 font-bold text-xs uppercase tracking-wider transition-all hover:scale-105 shadow-lg shadow-primary/20"
          id="addservice-button-a-adir-servicio-1" 
          data-testid="addservice-add-button"
        >
            <PlusCircle className="h-4 w-4" />
            Añadir Producto
        </Button>
    </EditServiceDialog>
  );
}
