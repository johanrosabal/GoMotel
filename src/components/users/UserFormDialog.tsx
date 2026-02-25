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

const userFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, 'El nombre es requerido.').max(25),
  lastName: z.string().min(1, 'El primer apellido es requerido.').max(25),
  secondLastName: z.string().max(25).optional(),
  email: z.string().email('Correo electrónico inválido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').optional(),
  role: z.enum(['Administrador', 'Recepcion']),
  idCard: z.string().min(1, 'La cédula es requerida.'),
  phoneNumber: z.string().min(1, 'El teléfono es requerido.'),
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
    } else if (open && !user) {
      form.reset({
        firstName: '', lastName: '', secondLastName: '', email: '', password: '', role: 'Recepcion', idCard: '', phoneNumber: '', birthDate: ''
      });
    }
  }, [open, user, form]);

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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem><FormLabel>Primer Apellido</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="secondLastName" render={({ field }) => (
                    <FormItem><FormLabel>Segundo Apellido</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="idCard" render={({ field }) => (
                    <FormItem><FormLabel>Cédula</FormLabel><FormControl><Input {...field} placeholder="0-0000-0000" /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" {...field} readOnly={isEdit} className={isEdit ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Rol / Permisos</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="Administrador">Administrador</SelectItem>
                                <SelectItem value="Recepcion">Recepción</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                    <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} placeholder="(506) 8888-8888" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="birthDate" render={({ field }) => (
                    <FormItem><FormLabel>Fecha de Nacimiento</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            {!isEdit && (
                <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Contraseña Inicial</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : (isEdit ? 'Guardar Cambios' : 'Crear Usuario')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
