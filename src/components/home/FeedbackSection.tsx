'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight, MessageSquareWarning, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FeedbackSection() {
  return (
    <section id="feedback-section" className="py-20 relative overflow-hidden bg-slate-950 border-t border-white/10 text-white">
      {/* Subtle Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="p-8 md:p-14 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-primary text-[10px] font-black uppercase tracking-[0.3em]">
            <ShieldCheck className="h-3.5 w-3.5" /> Canal Confidencial Directo a Gerencia
          </div>

          <div className="space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
              Quejas o Mejoras de Servicio
            </h2>
            <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed">
              Su experiencia es indispensable para nosotros. Si tiene alguna inconformidad o sugerencia para optimizar el servicio, puede hacérnosla llegar de forma totalmente privada a través de nuestro formulario en línea.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              className="w-full sm:w-auto h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary/20 transition-all hover:scale-[1.03] active:scale-[0.97]"
            >
              <Link href="/feedback" className="flex items-center justify-center gap-2">
                <MessageSquareWarning className="h-4 w-4" />
                Completar Formulario de Quejas o Sugerencias
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
