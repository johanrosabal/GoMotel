'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  MessageSquareWarning, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  Mail, 
  Phone, 
  MessageCircle, 
  FileText, 
  ShieldCheck, 
  ArrowLeft,
  Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { submitFeedbackTicket } from '@/lib/actions/feedback.actions';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { CompanyProfile } from '@/types';
import { cn } from '@/lib/utils';

export default function PublicFeedbackPage() {
  const { firestore } = useFirebase();
  const companyRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'companyInfo', 'main');
  }, [firestore]);
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  const [type, setType] = useState<'Queja' | 'Mejora de Servicio'>('Mejora de Servicio');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const formatCRPhoneInput = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.startsWith('506')) {
      cleaned = cleaned.slice(3);
    }
    cleaned = cleaned.slice(0, 8);
    if (cleaned.length <= 4) return cleaned;
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatCRPhoneInput(e.target.value));
  };

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWhatsapp(formatCRPhoneInput(e.target.value));
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value.toLowerCase().replace(/\s+/g, ''));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!details.trim() || details.trim().length < 5) {
      toast({
        title: 'Detalle requerido',
        description: 'Por favor escriba el detalle de su solicitud (mínimo 5 caracteres).',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await submitFeedbackTicket({
        type,
        email,
        phone,
        whatsapp,
        subject,
        details,
      });

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        setSubmitted(true);
        toast({
          title: '¡Registro Enviado!',
          description: 'Agradecemos sus comentarios. La administración revisará su solicitud.',
        });
      }
    });
  };

  const handleReset = () => {
    setEmail('');
    setPhone('');
    setWhatsapp('');
    setSubject('');
    setDetails('');
    setSubmitted(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between relative overflow-hidden selection:bg-primary selection:text-white">
      {/* Background Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Header Bar */}
      <header className="py-6 px-6 max-w-7xl mx-auto w-full flex items-center justify-between relative z-20 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9 transition-transform group-hover:scale-105">
            <Image
              src={company?.logoUrl || "/logo_manolo.png"}
              alt="Logo"
              fill
              className="object-contain"
            />
          </div>
          <span className="text-lg font-black tracking-tighter uppercase italic text-white">
            {company?.tradeName || 'Go Motel'}
          </span>
        </Link>

        <Button asChild variant="ghost" className="rounded-full text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-white/10">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver al Inicio
          </Link>
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full relative z-10 flex flex-col justify-center">
        <div className="text-center space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-primary text-[10px] font-black uppercase tracking-[0.3em]">
            <ShieldCheck className="h-3.5 w-3.5" /> Canal Confidencial Directo a Gerencia
          </div>
          <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]">
            Quejas o Mejoras de Servicio
          </h1>
          <p className="text-sm md:text-base text-slate-400 font-medium max-w-xl mx-auto">
            Su experiencia es nuestra máxima prioridad. Envíe sus inquietudes o ideas para ayudarnos a mantener los más altos estándares de calidad.
          </p>
        </div>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-10 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-2xl text-center space-y-6 shadow-2xl"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase italic tracking-tight text-white">
                ¡Registro Enviado Exitosamente!
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
                Su comentario ha sido canalizado directamente a la Gerencia y Administración. Nos pondremos en contacto si proporcionó sus datos.
              </p>
            </div>
            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleReset} variant="outline" className="rounded-2xl h-12 px-6 font-black uppercase text-xs tracking-widest border-white/20 text-white hover:bg-white/10">
                Enviar otro formulario
              </Button>
              <Button asChild className="rounded-2xl h-12 px-8 font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90 text-white">
                <Link href="/">
                  <Home className="h-4 w-4 mr-2" /> Regresar al Inicio
                </Link>
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="p-6 md:p-10 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] space-y-8"
          >
            {/* Type Selector */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Seleccione Tipo de Registro *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setType('Mejora de Servicio')}
                  className={cn(
                    "p-5 rounded-2xl border flex items-center gap-4 transition-all text-left group",
                    type === 'Mejora de Servicio'
                      ? "bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/10"
                      : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-xl transition-colors",
                    type === 'Mejora de Servicio' ? "bg-amber-500 text-black font-bold" : "bg-white/5 text-amber-400"
                  )}>
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-sm font-black uppercase tracking-wider block">Mejora de Servicio</span>
                    <span className="text-[11px] text-slate-400">Sugerencias para optimizar su experiencia</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setType('Queja')}
                  className={cn(
                    "p-5 rounded-2xl border flex items-center gap-4 transition-all text-left group",
                    type === 'Queja'
                      ? "bg-rose-500/10 border-rose-500 text-white shadow-lg shadow-rose-500/10"
                      : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-xl transition-colors",
                    type === 'Queja' ? "bg-rose-500 text-white font-bold" : "bg-white/5 text-rose-400"
                  )}>
                    <MessageSquareWarning className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-sm font-black uppercase tracking-wider block">Queja de Servicio</span>
                    <span className="text-[11px] text-slate-400">Reporte de inconformidad o eventualidad</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Contact Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-primary" /> Correo Electrónico
                </label>
                <Input
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={handleEmailChange}
                  className="h-12 bg-white/5 border-white/10 text-white rounded-xl text-xs placeholder:text-slate-500 focus:border-primary lowercase"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" /> Teléfono
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-slate-400 select-none pointer-events-none">+506</span>
                  <Input
                    type="tel"
                    placeholder="8888-8888"
                    value={phone}
                    onChange={handlePhoneChange}
                    className="h-12 pl-14 bg-white/5 border-white/10 text-white rounded-xl text-xs placeholder:text-slate-500 focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-400" /> WhatsApp
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-slate-400 select-none pointer-events-none">+506</span>
                  <Input
                    type="tel"
                    placeholder="8888-8888"
                    value={whatsapp}
                    onChange={handleWhatsappChange}
                    className="h-12 pl-14 bg-white/5 border-white/10 text-white rounded-xl text-xs placeholder:text-slate-500 focus:border-emerald-400 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Subject Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" /> Asunto / Título
              </label>
              <Input
                type="text"
                placeholder="Resumen breve del asunto..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-12 bg-white/5 border-white/10 text-white rounded-xl text-xs placeholder:text-slate-500 focus:border-primary"
              />
            </div>

            {/* Details Area */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Detalle del Asunto *
              </label>
              <Textarea
                rows={5}
                placeholder="Describa detalladamente lo sucedido o su propuesta de mejora..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="bg-white/5 border-white/10 text-white rounded-2xl text-xs placeholder:text-slate-500 focus:border-primary"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isPending || !details.trim()}
              className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Send className="h-4 w-4 mr-2" />
              {isPending ? 'Enviando Registro...' : 'Enviar Comentario a la Administración'}
            </Button>
          </motion.form>
        )}
      </main>

      {/* Footer copyright */}
      <footer className="py-6 border-t border-white/5 text-center text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
        © 2026 {company?.tradeName || 'Go Motel'} - Canal Oficial de Atención al Cliente
      </footer>
    </div>
  );
}
