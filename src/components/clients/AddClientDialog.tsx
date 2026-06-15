'use client';

import { useState, useTransition, type ReactNode, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Client } from '@/types';
import { checkClientByIdCard } from '@/lib/actions/client.actions';
import { useFirebase } from '@/firebase';
import { doc, updateDoc, addDoc, collection, Timestamp, serverTimestamp } from 'firebase/firestore';
import { Textarea } from '../ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { getSystemSettings } from '@/lib/actions/system.actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface AddClientDialogProps {
  children?: ReactNode;
  client?: Client;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const clientSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, 'El nombre es requerido.').max(50, 'El nombre no debe exceder los 50 caracteres.'),
  lastName: z.string().min(1, 'El apellido es requerido.').max(50, 'El apellido no debe exceder los 50 caracteres.'),
  secondLastName: z.string().max(50, 'El segundo apellido no debe exceder los 50 caracteres.').optional(),
  idCard: z.string().min(1, 'La cédula es requerida.'),
  email: z.string().email('Correo electrónico inválido.').optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  whatsappNumber: z.string().optional(),
  birthDate: z.coerce.date().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  isVip: z.boolean().default(false),
  isValidated: z.boolean().default(false),
});

export default function AddClientDialog({ children, client, open: controlledOpen, onOpenChange: setControlledOpen }: AddClientDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [duplicateClient, setDuplicateClient] = useState<any | null>(null);
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: client ? {
      firstName: '',
      lastName: '',
      secondLastName: '',
      idCard: '',
      email: '',
      phoneNumber: '',
      whatsappNumber: '',
      address: '',
      notes: '',
      isVip: false,
      isValidated: false,
      isForeigner: false,
      ...client,
      birthDate: client.birthDate?.toDate(),
      isVip: client.isVip || false,
      isForeigner: client.isForeigner || false,
    } : {
      firstName: '',
      lastName: '',
      secondLastName: '',
      idCard: '',
      email: '',
      phoneNumber: '',
      whatsappNumber: '',
      address: '',
      notes: '',
      isVip: false,
      isValidated: false,
      isForeigner: false,
    },
  });

  useEffect(() => {
    if (open) {
      setDuplicateClient(null);
      const defaultValues = client ? {
        firstName: '', lastName: '', secondLastName: '', idCard: '', email: '', phoneNumber: '',
        whatsappNumber: '', address: '', notes: '', isVip: false,
        ...client,
        birthDate: client.birthDate?.toDate(),
      } : {
        firstName: '', lastName: '', secondLastName: '', idCard: '', email: '', phoneNumber: '',
        whatsappNumber: '', address: '', notes: '', isVip: false, birthDate: undefined
      };
      form.reset(defaultValues);

      if (client && client.birthDate) {
        const date = client.birthDate.toDate();
        setBirthDay(String(date.getDate()));
        setBirthMonth(String(date.getMonth() + 1));
        setBirthYear(String(date.getFullYear()));
      } else {
        setBirthDay('');
        setBirthMonth('');
        setBirthYear('');
      }
    }
  }, [open, client, form]);

  useEffect(() => {
    if (birthDay && birthMonth && birthYear) {
      const day = parseInt(birthDay, 10);
      const month = parseInt(birthMonth, 10) - 1; // JS months are 0-indexed
      const year = parseInt(birthYear, 10);
      const date = new Date(year, month, day);

      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        form.setValue('birthDate', date, { shouldValidate: true });
        form.clearErrors('birthDate');

        // Calculate age
        const today = new Date();
        let age = today.getFullYear() - date.getFullYear();
        const m = today.getMonth() - date.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
          age--;
        }
        setCalculatedAge(age);
      } else {
        form.setError('birthDate', { type: 'manual', message: 'Fecha no válida.' });
        setCalculatedAge(null);
      }
    } else if (!birthDay && !birthMonth && !birthYear) {
      form.setValue('birthDate', undefined, { shouldValidate: true });
      form.clearErrors('birthDate');
    }
  }, [birthDay, birthMonth, birthYear, form]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'idCard') {
        form.setValue('isValidated', false);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - 18 - i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i, 1).toLocaleString('es', { month: 'long' }),
  }));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

  const { firestore } = useFirebase();

  const onSubmit = async (values: z.infer<typeof clientSchema>) => {
    try {
      const { id, ...clientData } = values;
      const dataToSave = {
        ...clientData,
        birthDate: clientData.birthDate ? Timestamp.fromDate(clientData.birthDate) : null,
        isVip: clientData.isVip || false,
        isValidated: clientData.isValidated || false,
        isForeigner: clientData.isForeigner || false,
      };

      if (id) {
        const clientRef = doc(firestore, 'clients', id);
        await updateDoc(clientRef, dataToSave);
      } else {
        await addDoc(collection(firestore, 'clients'), {
          ...dataToSave,
          createdAt: serverTimestamp(),
          visitCount: 0,
        });
      }
      toast({ title: '¡Éxito!', description: `El cliente ${values.firstName} ha sido guardado.` });
      setOpen(false);
    } catch (error) {
      console.error('Error saving client:', error);
      toast({ title: 'Error al Guardar', description: 'No se pudo guardar el cliente.', variant: 'destructive' });
    }
  };

  const handleIdCardChange = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (value: string) => void) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const maxLength = 9;
    const value = rawValue.slice(0, maxLength);

    let maskedValue = '';
    if (value.length > 5) {
      maskedValue = `${value.slice(0, 1)}-${value.slice(1, 5)}-${value.slice(5)}`;
    } else if (value.length > 1) {
      maskedValue = `${value.slice(0, 1)}-${value.slice(1)}`;
    } else {
      maskedValue = value;
    }

    fieldOnChange(maskedValue);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (value: string) => void) => {
    let numbers = e.target.value.replace(/\D/g, '');

    if (numbers.startsWith('506')) {
      numbers = numbers.substring(3);
    }
    const value = numbers.slice(0, 8);
    let maskedValue = '';
    if (value.length > 0) {
      maskedValue = `(506) ${value.slice(0, 4)}`;
      if (value.length > 4) {
        maskedValue += `-${value.slice(4)}`;
      }
    }
    fieldOnChange(maskedValue);
  };

  const toTitleCase = (str: string) => {
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
  };

  const handleVerify = async () => {
    const idCard = form.getValues('idCard');
    const cleanId = idCard.replace(/\D/g, '');

    if (cleanId.length < 9) {
      toast({ title: 'Cédula incompleta', description: 'Por favor ingrese los 9 dígitos de la cédula.', variant: 'destructive' });
      return;
    }

    setIsVerifying(true);
    setDuplicateClient(null);
    try {
      // 1. Check if client already exists in local database
      const existingClient = await checkClientByIdCard(idCard);
      if (existingClient) {
        setDuplicateClient(existingClient);
        setIsVerifying(false);
        return;
      }

      // 2. Si no existe, se le indica al usuario que lo agregue manualmente
      form.setValue('isValidated', false);
      toast({ title: 'Cliente no encontrado', description: 'No se encontró en la base de datos. Por favor ingrese los datos manualmente.', variant: 'default' });

    } catch (error) {
      toast({ title: 'Error', description: 'Error al verificar la cédula en la base de datos.', variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Añadir Nuevo Cliente'}</DialogTitle>
          <DialogDescription>
            {client ? `Actualizando la ficha de ${client.firstName}.` : 'Complete el formulario para registrar un nuevo cliente.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="addclientdialog-form-main" data-testid="addclientdialog-main-form">
            {duplicateClient && (
              <Alert className="bg-orange-500/10 border-orange-500/30 text-orange-500 animate-in fade-in zoom-in duration-300">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div className="flex flex-col gap-3 w-full">
                  <div>
                    <AlertTitle className="font-black uppercase tracking-[0.2em] text-[10px] mb-1">Cliente ya existe</AlertTitle>
                    <AlertDescription className="text-xs font-bold leading-relaxed">
                      El cliente <span className="text-white underline">{duplicateClient.firstName} {duplicateClient.lastName}</span> ya está registrado con la cédula <span className="font-mono">{duplicateClient.idCard}</span>.
                    </AlertDescription>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setOpen(false)}
                    className="w-fit border-orange-500/20 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400 font-black uppercase text-[10px] tracking-widest"
                  >
                    Cerrar Ventana
                  </Button>
                </div>
              </Alert>
            )}

            <FormField control={form.control} name="idCard" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Cédula
                  {form.watch('isValidated') && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">Verificada</span>}
                </FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input placeholder="9-9999-9999" {...field} onChange={(e) => handleIdCardChange(e, field.onChange)} id="addclientdialog-input-0-0000-0000" data-testid="addclientdialog-idcard-input" />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleVerify}
                        disabled={isVerifying}
                        className="shrink-0" data-testid="addclientdialog-action-button"
                      >
                        {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verificar'}
                      </Button>
                    </div>
                    {isVerifying && <Progress value={100} className="h-1 animate-pulse" />}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid md:grid-cols-2 gap-4">
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem><FormLabel>Primer Apellido</FormLabel><FormControl><Input placeholder="Pérez" {...field} id="addclientdialog-input-p-rez" data-testid="addclientdialog-lastname-input" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="Juan" {...field} id="addclientdialog-input-juan" data-testid="addclientdialog-firstname-input" /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="secondLastName" render={({ field }) => (
              <FormItem><FormLabel>Segundo Apellido (Opcional)</FormLabel><FormControl><Input placeholder="García" {...field} id="addclientdialog-input-garc-a" data-testid="addclientdialog-secondlastname-input" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex justify-between items-center">
                    <span>Fecha de Nacimiento (Opcional)</span>
                    {calculatedAge !== null && (
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                        calculatedAge < 18 ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-primary/10 text-primary border border-primary/20"
                      )}>
                        {calculatedAge} años {calculatedAge < 18 && "• MENOR"}
                      </span>
                    )}
                  </FormLabel>
                  <div className="space-y-4">
                    {calculatedAge !== null && calculatedAge < 18 && (
                      <Alert variant="destructive" className="py-2 px-3 animate-in fade-in slide-in-from-top-1">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="text-sm font-black">ADVERTENCIA: MENOR DE EDAD</AlertTitle>
                        <AlertDescription className="text-xs">
                          Este cliente tiene {calculatedAge} años. Por favor, asegúrese de cumplir con las regulaciones para menores de edad.
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <Select onValueChange={setBirthDay} value={birthDay}>
                        <FormControl>
                          <SelectTrigger id="addclientdialog-selecttrigger-1" data-testid="addclientdialog-day-select">
                            <SelectValue placeholder="Día" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {days.map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select onValueChange={setBirthMonth} value={birthMonth}>
                        <FormControl>
                          <SelectTrigger id="addclientdialog-selecttrigger-2" data-testid="addclientdialog-month-select">
                            <SelectValue placeholder="Mes" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {months.map((m) => (
                            <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select onValueChange={setBirthYear} value={birthYear}>
                        <FormControl>
                          <SelectTrigger id="addclientdialog-selecttrigger-3" data-testid="addclientdialog-year-select">
                            <SelectValue placeholder="Año" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {years.map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid md:grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Correo Electrónico (Opcional)</FormLabel><FormControl><Input type="email" placeholder="juan@perez.com" {...field} id="addclientdialog-input-juan-perez-com" data-testid="addclientdialog-email-input" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                <FormItem><FormLabel>Teléfono (Opcional)</FormLabel><FormControl><Input placeholder="(506) 8888-8888" {...field} onChange={(e) => handlePhoneChange(e, field.onChange)} id="addclientdialog-input-506-8888-8888" data-testid="addclientdialog-phonenumber-input" /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notas Internas</FormLabel><FormControl><Textarea placeholder="Cliente frecuente, prefiere habitaciones tranquilas..." {...field} id="addclientdialog-textarea-cliente-frecuente-prefiere" data-testid="addclientdialog-notes-textarea" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField
              control={form.control}
              name="isVip"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Cliente VIP / Favorito</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Los clientes VIP se destacarán en la lista para un reconocimiento rápido.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange} id="addclientdialog-switch-1" data-testid="addclientdialog-isvip-switch"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isForeigner"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Cliente Extranjero</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Marque si el cliente es extranjero (no se puede verificar cédula).
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} id="addclientdialog-button-cancelar" data-testid="addclientdialog-cancel-button">Cancelar</Button>
              <Button type="submit" disabled={isPending} id="addclientdialog-button-1" data-testid="addclientdialog-submit-button">
                {isPending ? 'Guardando...' : (client ? 'Guardar Cambios' : 'Crear Cliente')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
