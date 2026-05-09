'use client';

import { useState, useTransition, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { finishCleaning } from '@/lib/actions/room.actions';
import { Check, AlertTriangle, ShieldAlert, FileText, Smartphone } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { Room, Stay } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useUserProfile } from '@/hooks/use-user-profile';

const cleaningReportSchema = z.object({
  remoteControlRecovered: z.boolean().default(true),
  roomCondition: z.enum(['Perfecto', 'Daños', 'Problemas']),
  notes: z.string().optional(),
});

interface CleaningReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
}

export default function CleaningReportDialog({ open, onOpenChange, room }: CleaningReportDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { userProfile } = useUserProfile();
  const [lastStay, setLastStay] = useState<Stay | null>(null);
  const [isLoadingStay, setIsLoadingStay] = useState(false);

  const form = useForm<z.infer<typeof cleaningReportSchema>>({
    resolver: zodResolver(cleaningReportSchema),
    defaultValues: {
      remoteControlRecovered: true,
      roomCondition: 'Perfecto',
      notes: '',
    },
  });

  useEffect(() => {
    async function fetchLastStay() {
      if (!open || !room.lastStayId || !firestore) return;
      setIsLoadingStay(true);
      try {
        const stayDoc = await getDoc(doc(firestore, 'stays', room.lastStayId));
        if (stayDoc.exists()) {
          setLastStay({ id: stayDoc.id, ...stayDoc.data() } as Stay);
        }
      } catch (error) {
        console.error('Error fetching last stay:', error);
      } finally {
        setIsLoadingStay(false);
      }
    }
    fetchLastStay();
  }, [open, room.lastStayId, firestore]);

  const onSubmit = (values: z.infer<typeof cleaningReportSchema>) => {
    startTransition(async () => {
      const result = await finishCleaning(room.id, {
        ...values,
        reportedBy: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Empleado',
      });

      if (result.success) {
        toast({ 
            title: result.nextStatus === 'Available' ? 'Habitación Lista' : 'Habitación a Mantenimiento', 
            description: `La suite ${room.number} ha sido procesada correctamente.` 
        });
        onOpenChange(false);
        form.reset();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  const hasRemoteControl = lastStay?.remoteControlDelivered;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-white/10 text-white rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
             <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <ShieldAlert className="h-5 w-5" />
             </div>
             Reporte de Limpieza
          </DialogTitle>
          <DialogDescription className="text-slate-400 font-medium">
            Finalice la limpieza de la <span className="text-white font-bold">Suite {room.number}</span> informando el estado actual.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            {hasRemoteControl && (
              <FormField
                control={form.control}
                name="remoteControlRecovered"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-4 space-y-0 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-inner">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="h-6 w-6 border-amber-500/50 data-[state=checked]:bg-amber-500" id="cleaningreportdialog-checkbox-1" data-testid="cleaningreportdialog-remote-recovered-checkbox"
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="text-sm font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        Control Remoto Recuperado
                      </FormLabel>
                      <p className="text-[10px] text-slate-400 font-medium italic">Marque si el control fue devuelto en buen estado.</p>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="roomCondition"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Estado de la Habitación</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl text-slate-200 focus:ring-amber-500/20 transition-all font-bold" id="cleaningreportdialog-selecttrigger-1" data-testid="cleaningreportdialog-condition-select">
                        <SelectValue placeholder="Seleccione el estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-900 border-white/10 rounded-2xl">
                      <SelectItem value="Perfecto" className="py-3 font-bold">
                        <div className="flex items-center gap-3"><Check className="h-4 w-4 text-emerald-400" /> Todo Perfecto (Disponible)</div>
                      </SelectItem>
                      <SelectItem value="Daños" className="py-3 font-bold text-amber-400">
                        <div className="flex items-center gap-3"><AlertTriangle className="h-4 w-4" /> Daños Menores (Mantenimiento)</div>
                      </SelectItem>
                      <SelectItem value="Problemas" className="py-3 font-bold text-rose-500">
                        <div className="flex items-center gap-3"><ShieldAlert className="h-4 w-4" /> Problemas Graves (Mantenimiento)</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="space-y-3">
                   <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1 flex items-center gap-2">
                      <FileText className="h-3 w-3" />
                      Observaciones / Detalles
                   </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Escriba aquí cualquier anomalía o detalle relevante..." 
                      className="min-h-[100px] bg-white/5 border-white/10 rounded-2xl resize-none focus-visible:ring-amber-500/20" 
                      {...field} id="cleaningreportdialog-textarea-escriba-aqu-cualquier" data-testid="cleaningreportdialog-notes-textarea"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button 
                type="submit" 
                disabled={isPending}
                className="w-full h-14 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-95" id="cleaningreportdialog-button-1" data-testid="cleaningreportdialog-submit-button"
              >
                {isPending ? 'Enviando Reporte...' : 'Finalizar y Liberar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
