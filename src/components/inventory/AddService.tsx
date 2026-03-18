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
      <Button size="sm" disabled id="addservice-button-a-adir-servicio">
        <PlusCircle className="mr-2 h-4 w-4" />
        Añadir Servicio
      </Button>
    );
  }

  return (
    <EditServiceDialog allServices={allServices}>
        <Button size="sm" id="addservice-button-a-adir-servicio-1">
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Servicio
        </Button>
    </EditServiceDialog>
  );
}
