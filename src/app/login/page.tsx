'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Lock, Mail, ArrowRight, ChevronLeft } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { motion } from 'framer-motion';

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
import { useFirebase } from '@/firebase';

const loginSchema = z.object({
  email: z.string().email('Por favor ingrese un correo electrónico válido.'),
  password: z.string().min(1, 'La contraseña es requerida.'),
});

export default function LoginPage() {
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
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-[#050505]">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/motel_exterior_night_1773958134736.png"
          alt="Background"
          fill
          className="object-cover opacity-30 blur-sm scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#050505] via-transparent to-[#050505] opacity-80" />
      </div>

      <div className="container relative z-10 px-6 py-12 flex flex-col items-center">
        {/* Header/Logo */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 flex items-center gap-4"
        >
          <Link href="/" className="group flex items-center gap-2 px-4 py-2 rounded-2xl hover:bg-white/5 transition-all">
            <ChevronLeft className="h-4 w-4 text-white/40 group-hover:text-primary transition-colors" />
            <span className="text-xs font-black uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">Volver a Inicio</span>
          </Link>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[480px] bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 md:p-14 shadow-2xl shadow-black/50"
        >
          <div className="mb-10 text-center">
             <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tighter italic text-white/90">Personal Autorizado</h2>
             </div>
             <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic mb-4">
                Bienvenido de <span className="text-primary italic">Vuelta</span>
             </h1>
             <p className="text-white/40 text-sm font-medium">Ingrese sus credenciales para acceder al sistema.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Correo Electrónico</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <Input
                          placeholder="admin@gomotel.com"
                          {...field}
                          className="h-14 bg-white/[0.03] border-white/5 rounded-2xl px-12 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium placeholder:text-white/10"
                        />
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[10px] uppercase font-bold tracking-widest text-red-400" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                     <div className="flex items-center justify-between ml-1">
                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Contraseña</FormLabel>
                        <Link href="#" className="text-[10px] font-black uppercase tracking-widest text-primary/60 hover:text-primary transition-colors">¿Olvidó su contraseña?</Link>
                     </div>
                    <FormControl>
                      <div className="relative group">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...field}
                          className="h-14 bg-white/[0.03] border-white/5 rounded-2xl px-12 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium placeholder:text-white/10"
                        />
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 text-white/20 hover:text-white hover:bg-transparent"
                          onClick={() => setShowPassword((prev) => !prev)}
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-[10px] uppercase font-bold tracking-widest text-red-400" />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full h-14 bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-primary/20 group overflow-hidden relative" 
                disabled={isPending}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isPending ? 'Validando...' : (
                    <>
                      Iniciar Sesión <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Button>
            </form>
          </Form>

          <div className="mt-12 text-center pt-8 border-t border-white/5">
            <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] mb-4">¿No tiene una cuenta?</p>
            <Link href="/register">
              <span className="text-xs font-black uppercase tracking-widest text-white/80 hover:text-primary transition-colors">Solicitar Registro</span>
            </Link>
          </div>
        </motion.div>

        {/* Branding Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 text-center"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">&copy; {new Date().getFullYear()} Motel Tres Hermanos - Sistema de Gestión</p>
        </motion.div>
      </div>
    </div>
  );
}
