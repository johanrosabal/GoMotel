'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { register } from '@/lib/actions/auth.actions';
import AppLogo from '@/components/AppLogo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const registerSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido.'),
  lastName: z.string().min(1, 'El primer apellido es requerido.'),
  secondLastName: z.string().optional(),
  birthDate: z.date({
    required_error: 'La fecha de nacimiento es requerida.',
  }),
  idCard: z.string().min(1, 'La cédula de identidad es requerida.'),
  phoneNumber: z.string().min(1, 'El número de teléfono es requerido.'),
  whatsappNumber: z.string().optional(),
  email: z.string().email('Por favor ingrese un correo electrónico válido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

export default function RegisterPage() {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      secondLastName: '',
      idCard: '',
      phoneNumber: '',
      whatsappNumber: '',
    },
  });

  useEffect(() => {
    if (birthDay && birthMonth && birthYear) {
      const day = parseInt(birthDay, 10);
      const month = parseInt(birthMonth, 10) - 1; // JS months are 0-indexed
      const year = parseInt(birthYear, 10);
      const date = new Date(year, month, day);

      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        form.setValue('birthDate', date, { shouldValidate: true });
      } else {
        form.setError('birthDate', { type: 'manual', message: 'Fecha no válida.' });
      }
    }
  }, [birthDay, birthMonth, birthYear, form]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - 18 - i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i, 1).toLocaleString('es', { month: 'long' }),
  }));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));


  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    startTransition(async () => {
      const result = await register(values);
      if (result?.error) {
        toast({
          title: 'Error de Registro',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: '¡Registro Exitoso!',
          description: 'Su cuenta ha sido creada.',
        });
        router.push('/dashboard');
      }
    });
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="hidden bg-muted lg:block relative">
        <Image
            src="https://picsum.photos/seed/register/1200/1800"
            alt="Recepción del hotel"
            data-ai-hint="hotel reception"
            fill
            className="object-cover"
        />
        <div className="absolute inset-0 bg-primary/60" />
         <div className="relative z-10 flex flex-col justify-between h-full p-10 text-white">
            <Link href="/" className="flex items-center gap-3">
                <AppLogo className="h-8 w-8" />
                <span className="text-xl font-bold">Go Motel</span>
            </Link>
            <div className="text-lg">
                <p className="font-semibold">"Desde que usamos Go Motel, nuestra eficiencia ha aumentado en un 40%. ¡No podríamos estar más contentos!"</p>
                <footer className="mt-4 text-base font-normal">- Dueño de Cadena Hotelera</footer>
            </div>
        </div>
      </div>
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-full max-w-lg gap-6 px-4">
          <div className="grid gap-2 text-center">
             <Link href="/" className="flex items-center justify-center gap-2 mb-4">
                <AppLogo className="h-8 w-8 text-primary" />
            </Link>
            <h1 className="text-3xl font-bold">Cree una cuenta nueva</h1>
            <p className="text-balance text-muted-foreground">
              ¿Ya tiene una cuenta?{' '}
              <Link href="/" className="font-medium text-primary hover:underline">
                Inicie sesión
              </Link>
            </p>
          </div>
          <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Juan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primer Apellido</FormLabel>
                        <FormControl>
                          <Input placeholder="Pérez" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <FormField
                  control={form.control}
                  name="secondLastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Segundo Apellido (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="García" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="birthDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha de Nacimiento</FormLabel>
                          <div className="grid grid-cols-3 gap-2">
                             <Select onValueChange={setBirthDay} value={birthDay}>
                               <FormControl>
                                <SelectTrigger>
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
                                  <SelectTrigger>
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
                                  <SelectTrigger>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="idCard"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cédula de Identidad</FormLabel>
                          <FormControl>
                            <Input placeholder="12345678-9" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                 </div>
                 <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Teléfono</FormLabel>
                          <FormControl>
                            <Input placeholder="+591 12345678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="whatsappNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp (Opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="+591 12345678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                 </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo Electrónico</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="nombre@ejemplo.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                            className="pr-10"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute inset-y-0 right-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? 'Creando cuenta...' : 'Crear Cuenta'}
                </Button>
              </form>
            </Form>
        </div>
      </div>
    </div>
  );
}
