'use client';

import { useState, useTransition, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { register } from '@/lib/actions/auth.actions';
import { updateUserProfile } from '@/lib/actions/user.actions';
import type { UserProfile } from '@/types';
import { Eye, EyeOff, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const userFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, 'El nombre es requerido.').max(25, 'El nombre no debe exceder los 25 caracteres.'),
  lastName: z.string().min(1, 'El primer apellido es requerido.').max(25, 'El primer apellido no debe exceder los 25 caracteres.'),
  secondLastName: z.string().max(25, 'El segundo apellido no debe exceder los 25 caracteres.').optional(),
  email: z.string().email('Correo electrónico inválido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').optional(),
  role: z.enum(['Administrador', 'Recepcion', 'Conserje', 'Contador']),
  idCard: z.string().length(11, 'Formato de Cédula inválido (0-0000-0000).'),
  phoneNumber: z.string().length(15, 'Formato de teléfono inválido ((506) 0000-0000).'),
  birthDate: z.string().min(1, 'La fecha de nacimiento es requerida.'),
});

interface UserFormDialogProps {
  children?: React.ReactNode;
  user?: any; // Serialized UserProfile
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function UserFormDialog({ children, user, open: controlledOpen, onOpenChange: setControlledOpen }: UserFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;
  
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const isEdit = !!user;

  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      secondLastName: '',
      email: '',
      password: '',
      role: 'Recepcion',
      idCard: '',
      phoneNumber: '',
      birthDate: '',
    },
  });

  useEffect(() => {
    if (open && user) {
      form.reset({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        secondLastName: user.secondLastName || '',
        email: user.email,
        role: user.role,
        idCard: user.idCard,
        phoneNumber: user.phoneNumber,
        birthDate: user.birthDate ? user.birthDate.split('T')[0] : '',
      });
      if (user.birthDate) {
        const date = new Date(user.birthDate);
        setBirthDay(String(date.getUTCDate()));
        setBirthMonth(String(date.getUTCMonth() + 1));
        setBirthYear(String(date.getUTCFullYear()));
      }
    } else if (open && !user) {
      form.reset({
        firstName: '', lastName: '', secondLastName: '', email: '', password: '', role: 'Recepcion', idCard: '', phoneNumber: '', birthDate: ''
      });
      setBirthDay('');
      setBirthMonth('');
      setBirthYear('');
    }
  }, [open, user, form]);

  useEffect(() => {
    if (birthDay && birthMonth && birthYear) {
      const day = birthDay.padStart(2, '0');
      const month = birthMonth.padStart(2, '0');
      const dateStr = `${birthYear}-${month}-${day}`;
      form.setValue('birthDate', dateStr, { shouldValidate: true });
    }
  }, [birthDay, birthMonth, birthYear, form]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - 18 - i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i, 1).toLocaleString('es', { month: 'long' }),
  }));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

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

  const onSubmit = (values: z.infer<typeof userFormSchema>) => {
    startTransition(async () => {
      let result;
      if (isEdit) {
        result = await updateUserProfile({ ...values, id: user.id });
      } else {
        // Validation for new user password
        if (!values.password) {
            form.setError('password', { message: 'La contraseña es requerida para nuevos usuarios.' });
            return;
        }
        result = await register(values as any);
      }

      if (result?.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '¡Éxito!', description: `Usuario ${isEdit ? 'actualizado' : 'creado'} correctamente.` });
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Usuario' : 'Añadir Nuevo Usuario'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Actualizando los datos de acceso de ${user.firstName}.` : 'Complete los datos para crear una nueva cuenta de personal.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="userformdialog-form-main" data-testid="userformdialog-main-form">
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} id="userformdialog-input-1" data-testid="userformdialog-1-input" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem><FormLabel>Primer Apellido</FormLabel><FormControl><Input {...field} id="userformdialog-input-2" data-testid="userformdialog-2-input" /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="secondLastName" render={({ field }) => (
                    <FormItem><FormLabel>Segundo Apellido</FormLabel><FormControl><Input {...field} id="userformdialog-input-3" data-testid="userformdialog-3-input" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="idCard" render={({ field }) => (
                    <FormItem><FormLabel>Cédula</FormLabel><FormControl><Input {...field} placeholder="0-0000-0000" onChange={(e) => handleIdCardChange(e, field.onChange)} id="userformdialog-input-0-0000-0000" data-testid="userformdialog-4-input" /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" {...field} readOnly={isEdit} className={isEdit ? "bg-muted" : ""} id="userformdialog-input-4" data-testid="userformdialog-5-input" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Rol / Permisos</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger id="userformdialog-selecttrigger-1" data-testid="userformdialog-1-select"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="Administrador">Administrador</SelectItem>
                                <SelectItem value="Recepcion">Recepción</SelectItem>
                                <SelectItem value="Conserje">Conserje</SelectItem>
                                <SelectItem value="Contador">Contador</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                    <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} placeholder="(506) 8888-8888" onChange={(e) => handlePhoneChange(e, field.onChange)} id="userformdialog-input-506-8888-8888" data-testid="userformdialog-6-input" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="birthDate" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Fecha de Nacimiento</FormLabel>
                        <div className="grid grid-cols-3 gap-2">
                            <Select onValueChange={setBirthDay} value={birthDay}>
                                <FormControl><SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Día" /></SelectTrigger></FormControl>
                                <SelectContent className="max-h-60">
                                    {days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select onValueChange={setBirthMonth} value={birthMonth}>
                                <FormControl><SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Mes" /></SelectTrigger></FormControl>
                                <SelectContent className="max-h-60">
                                    {months.map(m => <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select onValueChange={setBirthYear} value={birthYear}>
                                <FormControl><SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Año" /></SelectTrigger></FormControl>
                                <SelectContent className="max-h-60">
                                    {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            {!isEdit && (
                <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Contraseña Inicial</FormLabel>
                        <FormControl>
                            <div className="relative">
                                <Input type={showPassword ? "text" : "password"} {...field} className="pr-10" id="userformdialog-input-6" data-testid="userformdialog-8-input" />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
                                </Button>
                            </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} id="userformdialog-button-cancelar" data-testid="userformdialog-cancel-button">Cancelar</Button>
              <Button type="submit" disabled={isPending} id="userformdialog-button-1" data-testid="userformdialog-submit-button">
                {isPending ? 'Guardando...' : (isEdit ? 'Guardar Cambios' : 'Crear Usuario')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
