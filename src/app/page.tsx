'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';

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
import { login } from '@/lib/actions/auth.actions';
import AppLogo from '@/components/AppLogo';
import { useFirebase } from '@/firebase';

const loginSchema = z.object({
  email: z.string().email('Por favor ingrese un correo electrónico válido.'),
  password: z.string().min(1, 'La contraseña es requerida.'),
});

export default function HomePage() {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { auth } = useFirebase();

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
        try {
          // Also sign in on client to establish session
          await signInWithEmailAndPassword(auth, values.email, values.password);
          toast({
            title: '¡Bienvenido!',
            description: 'Ha iniciado sesión exitosamente.',
          });
          router.push('/dashboard');
        } catch (error: any) {
          let errorMessage = 'Ocurrió un error inesperado. Por favor, inténtelo de nuevo.';
          switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
              errorMessage = 'Correo electrónico o contraseña incorrectos.';
              break;
            case 'auth/invalid-email':
              errorMessage = 'El formato del correo electrónico no es válido.';
              break;
          }
          toast({
            title: 'Error de Inicio de Sesión',
            description: errorMessage,
            variant: 'destructive',
          });
        }
      }
    });
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <Link href="/" className="flex items-center justify-center gap-2 mb-4" id="page-app-logo">
              <AppLogo className="h-8 w-8 text-primary" />
            </Link>
            <h1 className="text-3xl font-bold">Inicie sesión en su cuenta</h1>
            <p className="text-balance text-muted-foreground">
              O{' '}
              <Link href="/register" className="font-medium text-primary hover:underline" id="page-link-cree-una-cuenta">
                cree una cuenta nueva
              </Link>
            </p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" id="page-form-main">
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
                        {...field} id="page-input-nombre-ejemplo-com"
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
                    <div className="flex items-center">
                      <FormLabel>Contraseña</FormLabel>
                    </div>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...field}
                          className="pr-10" id="page-input-1"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute inset-y-0 right-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} id="page-button-1"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isPending} id="page-button-2">
                {isPending ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>
          </Form>
        </div>
      </div>
      <div className="hidden bg-muted lg:block relative">
        <Image
          src="https://picsum.photos/seed/login/1200/1800"
          alt="Vestíbulo de hotel"
          data-ai-hint="hotel lobby"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-primary/60" />
        <div className="relative z-10 flex flex-col justify-between h-full p-10 text-white">
          <Link href="/" className="flex items-center gap-3" id="page-link-2">
            <AppLogo className="h-8 w-8" />
            <span className="text-xl font-bold">Go Motel</span>
          </Link>
          <div className="text-lg">
            <p className="font-semibold">"La mejor herramienta para gestionar nuestro motel. ¡Intuitiva, rápida y siempre confiable!"</p>
            <footer className="mt-4 text-base font-normal">- Gerente de Motel Satisfecho</footer>
          </div>
        </div>
      </div>
    </div>
  );
}
