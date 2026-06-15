'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, User, Mail, Lock, Phone, CreditCard, Calendar, ChevronLeft, ArrowRight, Smartphone, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
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
import { register } from '@/lib/actions/auth.actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase } from '@/firebase';
import { getSystemSettings } from '@/lib/actions/system.actions';
import { Progress } from '@/components/ui/progress';

const registerSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido.').max(25, 'El nombre no debe exceder los 25 caracteres.'),
  lastName: z.string().min(1, 'El primer apellido es requerido.').max(25, 'El primer apellido no debe exceder los 25 caracteres.'),
  secondLastName: z.string().max(25, 'El segundo apellido no debe exceder los 25 caracteres.').optional(),
  birthDate: z.date({
    required_error: 'La fecha de nacimiento es requerida.',
  }),
  idCard: z.string().length(11, 'Formato de Cédula de Identidad inválido. Use 0-0000-0000.'),
  phoneNumber: z.string().length(15, 'Formato de teléfono inválido. Use (506) XXXX-XXXX.'),
  whatsappNumber: z.string().optional(),
  email: z.string().email('Por favor ingrese un correo electrónico válido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
}).refine(data => {
  if (data.whatsappNumber && data.whatsappNumber.length > 0) {
    return data.whatsappNumber.length === 15;
  }
  return true;
}, {
  message: 'Formato de WhatsApp inválido. Use (506) XXXX-XXXX.',
  path: ['whatsappNumber'],
});

export default function RegisterPage() {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { auth } = useFirebase();

  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

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
      const month = parseInt(birthMonth, 10) - 1;
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
    if (numbers.startsWith('506')) numbers = numbers.substring(3);
    const value = numbers.slice(0, 8);

    let maskedValue = '';
    if (value.length > 0) {
      maskedValue = `(506) ${value.slice(0, 4)}`;
      if (value.length > 4) maskedValue += `-${value.slice(4)}`;
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
    try {
      const settings = await getSystemSettings();
      const domain = settings.verificationApiDomain || 'api-krdy3op4ma-uc.a.run.app';
      const response = await fetch(`https://${domain}/verify?cedula=${cleanId}`);
      const data = await response.json();

      if (data['person-found']) {
        const parts = data.name.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 3) {
          const secondLastName = parts.pop() || '';
          const lastName = parts.pop() || '';
          const firstName = parts.join(' ');
          form.setValue('firstName', toTitleCase(firstName));
          form.setValue('lastName', toTitleCase(lastName));
          form.setValue('secondLastName', toTitleCase(secondLastName));
        } else if (parts.length === 2) {
          form.setValue('firstName', toTitleCase(parts[0]));
          form.setValue('lastName', toTitleCase(parts[1]));
        } else {
          form.setValue('firstName', toTitleCase(parts[0]));
        }

        if (data['birth-date']) {
          const [d, m, y] = data['birth-date'].split('/');
          setBirthDay(String(parseInt(d, 10)));
          setBirthMonth(String(parseInt(m, 10)));
          setBirthYear(String(parseInt(y, 10)));
        }

        setIsValidated(true);
        toast({ title: 'Persona Encontrada', description: `¡Hola ${data.name}! La información ha sido cargada.` });
      } else {
        setIsValidated(false);
        toast({ title: 'No encontrado', description: 'No se encontró información para esta cédula.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error de Conexión', description: 'No se pudo conectar con el servicio de verificación.', variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

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
        try {
          await signInWithEmailAndPassword(auth, values.email, values.password);
          toast({
            title: '¡Registro Exitoso!',
            description: 'Su cuenta ha sido creada.',
          });
          router.push('/dashboard');
        } catch (error: any) {
          toast({
            title: 'Error de Inicio de Sesión',
            description: 'Ocurrió un error al iniciar sesión después del registro.',
            variant: 'destructive',
          });
        }
      }
    });
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-[#050505] py-20 dark">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/login_register_bg.png"
          alt="Background"
          fill
          className="object-cover opacity-60 scale-105"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/40 to-[#050505] opacity-90" />
      </div>

      <div className="container relative z-10 px-6 flex flex-col items-center">
        {/* Header/Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 flex items-center gap-4"
        >
          <Link href="/login" className="group flex items-center gap-2 px-4 py-2 rounded-2xl hover:bg-white/5 transition-all" data-testid="register-back-link">
            <ChevronLeft className="h-4 w-4 text-white/40 group-hover:text-primary transition-colors" />
            <span className="text-xs font-black uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">Volver a Login</span>
          </Link>
        </motion.div>

        {/* Register Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[800px] bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-black/50"
        >
          <div className="mb-12 text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                <User className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tighter italic text-white/90">Nueva Cuenta</h2>
            </div>
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic mb-4 text-white">
              Únete a la <span className="text-primary italic border-b-2 border-primary/30">Elite</span>
            </h1>
            <p className="text-white/40 text-sm font-medium">Complete el formulario para formar parte de nuestro equipo.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" data-testid="register-main-form">
              {/* Name Section */}
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Nombre</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Input placeholder="Juan" {...field} className="h-14 bg-white/[0.03] border-white/5 rounded-2xl px-12 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium placeholder:text-white/10 autofill:shadow-[0_0_0_1000px_#0a0a0a_inset] [-webkit-text-fill-color:white] text-white" data-testid="register-name-input" />
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px] uppercase font-bold tracking-widest text-red-400" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Primer Apellido</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Input placeholder="Pérez" {...field} className="h-14 bg-white/[0.03] border-white/5 rounded-2xl px-12 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium placeholder:text-white/10 autofill:shadow-[0_0_0_1000px_#0a0a0a_inset] [-webkit-text-fill-color:white] text-white" data-testid="register-lastname-input" />
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px] uppercase font-bold tracking-widest text-red-400" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="secondLastName"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Segundo Apellido (Opcional)</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <Input placeholder="García" {...field} className="h-14 bg-white/[0.03] border-white/5 rounded-2xl px-12 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium placeholder:text-white/10 autofill:shadow-[0_0_0_1000px_#0a0a0a_inset] [-webkit-text-fill-color:white] text-white" data-testid="register-second-lastname-input" />
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[10px] uppercase font-bold tracking-widest text-red-400" />
                  </FormItem>
                )}
              />

              {/* ID and Birthdate Section */}
              <div className="grid md:grid-cols-2 gap-6 items-start">
                <FormField
                  control={form.control}
                  name="idCard"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1 flex items-center justify-between">
                        <span>Cédula de Identidad</span>
                        {isValidated && (
                          <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-1 text-[8px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20"
                          >
                            <ShieldCheck className="h-2.5 w-2.5" /> Verificada
                          </motion.span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="relative group flex-1">
                              <Input
                                placeholder="0-0000-0000"
                                {...field}
                                onChange={(e) => {
                                  handleIdCardChange(e, field.onChange);
                                  setIsValidated(false);
                                }}
                                className="h-14 bg-white/[0.03] border-white/5 rounded-2xl px-12 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium placeholder:text-white/10 autofill:shadow-[0_0_0_1000px_#0a0a0a_inset] [-webkit-text-fill-color:white] text-white" data-testid="register-id-card-input"
                              />
                              <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={handleVerify}
                              disabled={isVerifying}
                              className="h-14 px-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-white/80 font-bold uppercase tracking-widest text-[10px] shrink-0" data-testid="register-action-verify-button"
                            >
                              {isVerifying ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : 'Verificar'}
                            </Button>
                          </div>
                          {isVerifying && <Progress value={100} className="h-1 animate-pulse bg-primary/10" />}
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px] uppercase font-bold tracking-widest text-red-400" />
                    </FormItem>
                  )}
                />
                <FormItem className="space-y-2">
                  <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Fecha de Nacimiento</FormLabel>
                  <div className="flex gap-2">
                    <Select onValueChange={setBirthDay} value={birthDay}>
                      <FormControl>
                        <SelectTrigger className="h-14 bg-white/[0.03] border-white/5 rounded-2xl focus:ring-primary/20 text-white/80" data-testid="register-birth-day-select">
                          <SelectValue placeholder="Día" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                        {days.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select onValueChange={setBirthMonth} value={birthMonth}>
                      <FormControl>
                        <SelectTrigger className="h-14 bg-white/[0.03] border-white/5 rounded-2xl focus:ring-primary/20 text-white/80" data-testid="register-birth-month-select">
                          <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                        {months.map((m) => <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select onValueChange={setBirthYear} value={birthYear}>
                      <FormControl>
                        <SelectTrigger className="h-14 bg-white/[0.03] border-white/5 rounded-2xl focus:ring-primary/20 text-white/80" data-testid="register-birth-year-select">
                          <SelectValue placeholder="Año" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
                        {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage className="text-[10px] uppercase font-bold tracking-widest text-red-400" />
                </FormItem>
              </div>

              {/* Contact Section */}
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Teléfono</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Input
                            placeholder="(506) 8888-8888"
                            {...field}
                            onChange={(e) => handlePhoneChange(e, field.onChange)}
                            className="h-14 bg-white/[0.03] border-white/5 rounded-2xl px-12 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium placeholder:text-white/10 text-white" data-testid="register-phone-input"
                          />
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px] uppercase font-bold tracking-widest text-red-400" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="whatsappNumber"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">WhatsApp (Opcional)</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Input
                            placeholder="(506) 8888-8888"
                            {...field}
                            onChange={(e) => handlePhoneChange(e, field.onChange)}
                            className="h-14 bg-white/[0.03] border-white/5 rounded-2xl px-12 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium placeholder:text-white/10 text-white" data-testid="register-whatsapp-input"
                          />
                          <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px] uppercase font-bold tracking-widest text-red-400" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Email and Password */}
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Correo Electrónico</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Input placeholder="admin@gomotel.com" {...field} className="h-14 bg-white/[0.03] border-white/5 rounded-2xl px-12 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium placeholder:text-white/10 autofill:shadow-[0_0_0_1000px_#0a0a0a_inset] [-webkit-text-fill-color:white] text-white" data-testid="register-email-input" />
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
                      <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                            className="h-14 bg-white/[0.03] border-white/5 rounded-2xl px-12 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium placeholder:text-white/10 autofill:shadow-[0_0_0_1000px_#0a0a0a_inset] [-webkit-text-fill-color:white] text-white" data-testid="register-8-input"
                          />
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 text-white/20 hover:text-white hover:bg-transparent"
                            onClick={() => setShowPassword((prev) => !prev)} data-testid="register-password-show-button"
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px] uppercase font-bold tracking-widest text-red-400" />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-primary/20 group overflow-hidden relative mt-8"
                disabled={isPending} data-testid="register-submit-button"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isPending ? 'Procesando...' : (
                    <>
                      Crear Cuenta <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Button>
            </form>
          </Form>

          <div className="mt-12 text-center pt-8 border-t border-white/5">
            <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] mb-4">¿Ya tiene una cuenta?</p>
            <Link href="/login" data-testid="register-login-link">
              <span className="text-xs font-black uppercase tracking-widest text-white/80 hover:text-primary transition-colors">Iniciar Sesión</span>
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
