'use client';

import React from 'react';
import { 
  Phone, 
  MessageCircle, 
  X, 
  Calendar, 
  Clock, 
  ShieldCheck 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface ReservationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber?: string;
  whatsappNumber?: string;
}

export function ReservationModal({ 
  isOpen, 
  onOpenChange,
  phoneNumber = "+506 2222-2222",
  whatsappNumber = "+506 8888-8888"
}: ReservationModalProps) {
  const whatsappClean = whatsappNumber.replace(/[^0-9]/g, '');
  const whatsappMessage = encodeURIComponent("Hola, me gustaría consultar disponibilidad para una habitación.");
  const whatsappLink = `https://wa.me/${whatsappClean}?text=${whatsappMessage}`;

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 8) {
      return `+ (506) ${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith('506')) {
      return `+ (506) ${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-border dark:border-white/10 bg-background dark:bg-[#0a0a0a]/95 backdrop-blur-2xl p-0 overflow-hidden rounded-[2.5rem]">
        <div className="relative p-8 md:p-12">
          {/* Decorative Background */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
          
          <DialogHeader className="relative z-10 mb-8">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 border border-primary/20">
              <Calendar className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter leading-tight text-foreground dark:text-white">
              Reserve su <br />
              <span className="text-primary">Momento Elite</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground dark:text-white/70 text-sm font-medium pt-4">
              Para garantizar su privacidad y el mejor servicio, nuestras reservaciones se gestionan directamente vía telefónica o WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 relative z-10">
            {/* Call Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <a href={`tel:${phoneNumber}`} className="block">
                <Button className="w-full h-20 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl flex items-center justify-between px-8 group overflow-hidden relative">
                  <div className="flex flex-col items-start relative z-10 text-left">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/80">Llamada Directa</span>
                    <span className="text-xl font-black tracking-tight italic">¡{formatPhoneNumber(phoneNumber)}!</span>
                  </div>
                  <div className="w-12 h-12 bg-primary-foreground/10 rounded-xl flex items-center justify-center relative z-10 group-hover:scale-110 transition-transform">
                    <Phone className="h-6 w-6" />
                  </div>
                  <div className="absolute inset-0 bg-primary-foreground/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </Button>
              </a>
            </motion.div>

            {/* WhatsApp Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" className="w-full h-20 bg-foreground/5 dark:bg-white/[0.03] border-border dark:border-white/5 hover:bg-accent dark:hover:bg-white/[0.08] hover:border-green-500/50 text-foreground dark:text-white rounded-2xl flex items-center justify-between px-8 group transition-all">
                  <div className="flex flex-col items-start text-left">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-white/60">Reserva Express</span>
                    <span className="text-xl font-black tracking-tight italic text-green-600 dark:text-green-400 leading-tight">WHATSAPP</span>
                    <span className="text-[10px] font-black tracking-widest text-green-600/90 dark:text-green-400/90">{formatPhoneNumber(whatsappNumber)}</span>
                  </div>
                  <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center group-hover:bg-green-500 group-hover:text-primary-foreground transition-all">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                </Button>
              </a>
            </motion.div>

            {/* Badges/Info */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-white/50">
                <Clock className="h-4 w-4 text-primary" />
                Atención 24/7
              </div>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-white/50">
                <ShieldCheck className="h-4 w-4 text-primary" />
                100% Discreto
              </div>
            </div>
          </div>

          <div className="mt-10 pt-4 text-center border-t border-border dark:border-white/5 relative z-10">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground dark:text-white/40">Motel Tres Hermanos - Exclusividad Sin Límites</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
