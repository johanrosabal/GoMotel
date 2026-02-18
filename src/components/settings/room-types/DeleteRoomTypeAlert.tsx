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
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

interface DeleteRoomTypeAlertProps {
  children: ReactNode;
  roomTypeId: string;
}

export default function DeleteRoomTypeAlert({ children, roomTypeId }: DeleteRoomTypeAlertProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteDoc(doc(firestore, 'roomTypes', roomTypeId));
        toast({
          title: '¡Éxito!',
          description: 'El tipo de habitación ha sido eliminado.',
        });
        router.refresh();
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'No se pudo eliminar el tipo de habitación.',
          variant: 'destructive',
        });
      } finally {
        setOpen(false);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Esto eliminará permanentemente el tipo de habitación.
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
