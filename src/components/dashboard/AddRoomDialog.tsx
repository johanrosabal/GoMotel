'use client';

import { useState, useTransition, type ReactNode, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveRoom, deleteRoom } from '@/lib/actions/room.actions';
import type { Room, RoomType } from '@/types';
import { Separator } from '../ui/separator';
import { Tag, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '../ui/badge';
import Link from 'next/link';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy as fbOrderBy } from 'firebase/firestore';

interface AddRoomDialogProps {
  children?: ReactNode;
  room?: Room;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const roomSchema = z.object({
  id: z.string().optional(),
  number: z.string().min(1, 'El número de habitación es requerido.'),
  roomTypeId: z.string({ required_error: 'El tipo de habitación es requerido.' }).min(1, 'El tipo de habitación es requerido.'),
});

export default function AddRoomDialog({ children, room, open: controlledOpen, onOpenChange: setControlledOpen }: AddRoomDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;

  const { firestore } = useFirebase();

  const roomTypesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roomTypes'), fbOrderBy('name'));
  }, [firestore]);
  const { data: roomTypes, isLoading: isLoadingRoomTypes } = useCollection<RoomType>(roomTypesQuery);

  const roomsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'rooms'));
  }, [firestore]);
  const { data: allRooms, isLoading: isLoadingRooms } = useCollection<Room>(roomsQuery);

  const form = useForm<z.infer<typeof roomSchema>>({
    resolver: zodResolver(roomSchema),
    defaultValues: room ? {
      id: room.id,
      number: room.number,
      roomTypeId: room.roomTypeId,
    } : {
      number: '',
      roomTypeId: undefined,
    },
  });

  // Handle form population when dialog opens
  useEffect(() => {
    if (open) {
      if (room) {
        // Editing mode
        form.reset({
          id: room.id,
          number: room.number,
          roomTypeId: room.roomTypeId,
        });
      } else {
        // Creation mode - pre-fill with next available number
        const lastRoomNumber = allRooms?.reduce((max, r) => {
          const num = parseInt(r.number, 10);
          return !isNaN(num) && num > max ? num : max;
        }, 0) || 0;

        const nextNumber = lastRoomNumber > 0 ? String(lastRoomNumber + 1) : '1';
        form.reset({ number: nextNumber, roomTypeId: undefined, id: undefined });
      }
    }
  }, [open, room, allRooms, form]);

  const selectedRoomTypeId = form.watch('roomTypeId');

  const selectedRoomType = useMemo(() => {
    return roomTypes?.find(rt => rt.id === selectedRoomTypeId);
  }, [selectedRoomTypeId, roomTypes]);

  const onSubmit = (values: z.infer<typeof roomSchema>) => {
    const rt = roomTypes?.find(rt => rt.id === values.roomTypeId);
    if (!rt) {
      toast({ title: 'Error', description: 'Por favor seleccione un tipo de habitación válido.', variant: 'destructive' });
      return;
    }
    if (!rt.capacity) {
      toast({ title: 'Error', description: 'El tipo de habitación seleccionado no tiene una capacidad definida.', variant: 'destructive' });
      return;
    }

    const hourlyRatePlan = rt.pricePlans?.find(p => p.unit === 'Hours' && p.duration === 1) || rt.pricePlans?.[0];
    const ratePerHour = hourlyRatePlan ? hourlyRatePlan.price : 0;

    const formData = new FormData();
    if (values.id) formData.append('id', values.id);
    formData.append('number', values.number.padStart(3, '0'));
    formData.append('capacity', String(rt.capacity));
    formData.append('roomTypeId', values.roomTypeId);
    formData.append('roomTypeName', rt.name);
    formData.append('type', rt.name);
    formData.append('description', rt.features?.join(', ') || '');
    formData.append('ratePerHour', String(ratePerHour));

    startTransition(async () => {
      const result = await saveRoom(formData);
      if (result?.error) {
        toast({
          title: 'Error',
          description: typeof result.error === 'string' ? result.error : 'No se pudo guardar la habitación.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '¡Éxito!',
          description: `La habitación "${values.number.padStart(3, '0')}" ha sido guardada.`,
        });
        setOpen(false);
      }
    });
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!room?.id) return;

    startTransition(async () => {
      const result = await deleteRoom(room.id);
      if (result?.error) {
        toast({
          title: 'Error al eliminar',
          description: typeof result.error === 'string' ? result.error : 'No se pudo eliminar la habitación.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '¡Eliminada!',
          description: `La habitación "${room.number}" ha sido eliminada con éxito.`,
        });
        setShowDeleteConfirm(false);
        setOpen(false);
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-slate-950/95 backdrop-blur-2xl border-white/10 text-white rounded-[2.5rem] shadow-2xl shadow-black/80">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-white">
            {room ? 'Editar Habitación' : 'Añadir Nueva Habitación'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {room
              ? `Actualizar detalles para la habitación ${room.number}.`
              : 'Añada los detalles de la nueva habitación a su motel.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="addroomdialog-form-main" data-testid="addroomdialog-main-form">
            <FormField
              control={form.control}
              name="roomTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tipo de Habitación</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingRoomTypes}>
                    <FormControl>
                      <SelectTrigger className="bg-white/5 border-white/10 rounded-xl text-white h-12" id="addroomdialog-selecttrigger-1" data-testid="addroomdialog-roomtype-select">
                        <SelectValue placeholder={isLoadingRoomTypes ? "Cargando tipos..." : "Seleccione un tipo"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roomTypes && roomTypes.length > 0 ? (
                        roomTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No hay tipos de habitación.
                          <Button variant="link" asChild className="pl-1" id="addroomdialog-button-1" data-testid="addroomdialog-action-button">
                            <Link href="/settings/room-types/new" id="addroomdialog-link-crear-uno" data-testid="addroomdialog-create-link">Crear uno</Link>
                          </Button>
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Número de Habitación</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="000"
                      {...field}
                      type="text"
                      inputMode="numeric"
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        field.onChange(value.slice(0, 3));
                      }}
                      className="text-[7.875rem] font-black text-center h-40 w-full bg-primary/5 rounded-3xl border border-white/10 shadow-inner focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]" id="addroomdialog-input-000" data-testid="addroomdialog-number-input"
                    />
                  </FormControl>
                  <FormMessage className="text-center" />
                </FormItem>
              )}
            />

            {selectedRoomType && (
              <div className="space-y-4 pt-2">
                <Separator />
                <div className="p-6 rounded-2xl border border-white/10 bg-white/5 space-y-4 shadow-xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 text-slate-500"><Users className="h-4 w-4 text-primary" />Capacidad</h4>
                      <p className="font-bold text-white text-lg">{selectedRoomType.capacity} persona(s)</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 text-slate-500"><Tag className="h-4 w-4 text-primary" />Características</h4>
                      {selectedRoomType.features && selectedRoomType.features.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedRoomType.features.map(feature => <Badge key={feature} variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-[10px] font-bold">{feature}</Badge>)}
                        </div>
                      ) : <p className="text-sm text-slate-500">Sin características.</p>}
                    </div>
                  </div>
                  <Separator className="bg-white/5" />
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 text-slate-500"><span className="w-4 text-center text-primary font-bold">₡</span>Planes de Precios</h4>
                    {selectedRoomType.pricePlans && selectedRoomType.pricePlans.length > 0 ? (
                      <ul className="space-y-2 text-sm">
                        {selectedRoomType.pricePlans.map(plan => (
                          <li key={plan.name} className="flex justify-between items-center">
                            <span className="text-slate-400 font-medium">{plan.name}</span>
                            <span className="font-black text-white italic tracking-tighter text-base">{formatCurrency(plan.price)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-slate-500">Sin planes de precios.</p>}
                  </div>
                </div>
              </div>
            )}

             <DialogFooter className="pt-6 flex flex-col sm:flex-row gap-4 border-t border-white/5">
              {room && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="w-full sm:w-auto rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 transition-all font-bold uppercase tracking-widest text-[10px] h-10 px-4"
                >
                  Eliminar Habitación
                </Button>
              )}
              <div className="flex flex-row gap-2 w-full sm:w-auto justify-end ml-auto">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending} className="flex-1 sm:flex-none rounded-xl border-white/10 text-white hover:bg-white/5 text-xs font-bold px-4 h-10">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending || isLoadingRoomTypes || isLoadingRooms} id="addroomdialog-button-2" data-testid="addroomdialog-submit-button" className="flex-1 sm:flex-none rounded-xl bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-xs px-4 h-10">
                  {isPending ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
      
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-slate-950/95 backdrop-blur-2xl border-white/10 text-white rounded-[2.5rem] shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase italic tracking-tighter text-white">¿Eliminar Habitación?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              ¿Está seguro de que desea eliminar la habitación <strong>{room?.number}</strong>? Esta acción no se puede deshacer y fallará si la habitación no está disponible (ej. si está ocupada, en limpieza o mantenimiento).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row gap-2 justify-end pt-4">
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" className="rounded-xl border-white/10 text-white hover:bg-white/5 text-xs font-bold px-4 h-10">
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button 
                onClick={confirmDelete} 
                disabled={isPending}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-widest text-xs px-4 h-10"
              >
                {isPending ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
