'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

const registerSchema = z.object({
    email: z.string().email('Por favor ingrese un correo electrónico válido.'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

export default function RegisterPage() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

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
        router.push('/');
      }
    });
  };

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader className="items-center text-center">
             <Link href="/" className="flex items-center justify-center gap-2">
                <AppLogo className="h-8 w-8 text-primary" />
            </Link>
            <CardTitle className="text-2xl">Cree una cuenta nueva</CardTitle>
            <CardDescription>
              ¿Ya tiene una cuenta?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Inicie sesión
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? 'Creando cuenta...' : 'Crear Cuenta'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
