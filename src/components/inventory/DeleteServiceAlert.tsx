'use client';

import { useState, useTransition, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { deleteService } from '@/lib/actions/service.actions';

interface DeleteServiceAlertProps {
  children?: ReactNode;
  serviceId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function DeleteServiceAlert({ children, serviceId, open: controlledOpen, onOpenChange: setControlledOpen }: DeleteServiceAlertProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;
  
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    setOpen(false);
    startTransition(async () => {
      const result = await deleteService(serviceId);
      if (result.error) {
        toast({
          title: 'Error',
          description: 'No se pudo eliminar el servicio.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '¡Éxito!',
          description: 'El servicio ha sido eliminado.',
        });
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {children && <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Esto eliminará permanentemente el servicio
            de su inventario.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Eliminando...' : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
