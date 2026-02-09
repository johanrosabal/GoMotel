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
import { login } from '@/lib/actions/auth.actions';
import AppLogo from '@/components/AppLogo';

const loginSchema = z.object({
  email: z.string().email('Por favor ingrese un correo electrónico válido.'),
  password: z.string().min(1, 'La contraseña es requerida.'),
});

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    startTransition(async () => {
      const result = await login(values);
      if (result?.error) {
        toast({
          title: 'Error de Inicio de Sesión',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: '¡Bienvenido!',
          description: 'Ha iniciado sesión exitosamente.',
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
            <CardTitle className="text-2xl">Inicie sesión en su cuenta</CardTitle>
            <CardDescription>
              O{' '}
              <Link href="/register" className="font-medium text-primary hover:underline">
                cree una cuenta nueva
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
                  {isPending ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
