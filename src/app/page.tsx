'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  Clock, 
  Zap, 
  MapPin, 
  Phone, 
  Instagram, 
  Facebook, 
  Star,
  ChevronRight,
  ArrowRight,
  Wifi,
  Coffee,
  Tv,
  Users
} from 'lucide-react';
import AppLogo from '@/components/AppLogo';
import { Button } from '@/components/ui/button';
import { ReservationModal } from '@/components/ReservationModal';

export default function LandingPage() {
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  
  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8 }
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-primary/30 selection:text-white overflow-x-hidden">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-md border-b border-white/5">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group" id="landing-logo">
            <div className="bg-primary/20 p-2 rounded-xl group-hover:scale-110 transition-transform">
              <AppLogo className="h-7 w-7 text-primary" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase italic">Motel Tres Hermanos</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-white transition-colors" id="landing-nav-features">Características</Link>
            <Link href="#pricing" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-white transition-colors" id="landing-nav-pricing">Tarifas</Link>
            <Link href="#gallery" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-white transition-colors" id="landing-nav-gallery">Galería</Link>
            <Link href="#contact" className="text-sm font-bold uppercase tracking-widest text-white/60 hover:text-white transition-colors" id="landing-nav-contact">Contacto</Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" id="landing-hero-auth-personal">
              <Button variant="ghost" className="text-sm font-black uppercase tracking-widest text-white/90 hover:text-white hover:bg-white/5 h-12 px-6 rounded-2xl border border-white/5">
                Acceso Personal
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative h-screen flex items-center justify-center overflow-hidden pt-20">
          <div className="absolute inset-0 z-0 scale-110">
            <Image 
              src="/motel_exterior_night_1773958134736.png" 
              alt="Motel Exterior" 
              fill 
              className="object-cover opacity-40 brightness-75"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-[#0a0a0a]/80" />
          </div>

          <div className="container mx-auto px-6 relative z-10 text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-8 backdrop-blur-sm"
            >
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">El Estándar del Placer y Privacidad</span>
            </motion.div>
            
            <motion.h1 
              {...fadeInUp}
              className="text-6xl md:text-8xl font-black tracking-tight mb-8 leading-[0.9] italic uppercase overflow-visible"
            >
              Exclusividad <br />
              <span className="inline-block pr-8 text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-primary">Sin Límites</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="max-w-2xl mx-auto text-white/60 text-lg md:text-xl font-medium mb-12"
            >
              Experimente la discreción absoluta y el confort premium en el motel más sofisticado de la región. Diseñado para quienes no aceptan menos que la perfección.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-16 scale-110"
            >
                <Button 
                  onClick={() => setIsReservationModalOpen(true)}
                  size="lg" 
                  className="bg-[#b399ff] hover:bg-[#a080ff] text-black text-xs font-black uppercase tracking-widest h-16 px-12 rounded-[2rem] shadow-2xl shadow-purple-500/40 flex items-center gap-3 group"
                >
                  Reservar Ahora
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
                <Link href="#gallery" id="landing-hero-btn-gallery">
                  <Button size="lg" variant="outline" className="bg-white/[0.03] border-white/10 hover:bg-white/[0.08] text-white text-xs font-black uppercase tracking-widest h-16 px-12 rounded-[2rem] backdrop-blur-md">
                    Ver Galería
                  </Button>
                </Link>
              </motion.div>
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-40">
            <span className="text-[9px] font-black uppercase tracking-[0.4em]">Scroll</span>
            <div className="w-[1px] h-10 bg-gradient-to-b from-white to-transparent" />
          </div>
        </section>

        {/* Features section */}
        <section id="features" className="py-32 bg-[#0c0c0c] relative">
          <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row items-end justify-between mb-20 gap-8">
              <div className="max-w-2xl">
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase mb-6">Por qué somos <span className="text-primary">Diferentes</span></h2>
                <p className="text-white/50 text-xl">Cada detalle ha sido curado para garantizar una experiencia de clase mundial, donde su privacidad es nuestra prioridad número uno.</p>
              </div>
              <div className="h-px flex-1 bg-white/5 mx-10 hidden md:block" />
            </div>

            <motion.div 
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-8"
            >
              {[
                { icon: ShieldCheck, title: "Máxima Privacidad", desc: "Entradas y salidas discretas con sistemas automatizados para que su visita sea totalmente privada." },
                { icon: Clock, title: "Servicio 24/7", desc: "Nuestro equipo está disponible a cualquier hora para atender sus necesidades con la mayor discreción." },
                { icon: Zap, title: "Confort Premium", desc: "Habitaciones equipadas con tecnología de punta, climatización inteligente y sistemas de sonido de alta fidelidad." }
              ].map((feature, i) => (
                <motion.div 
                  key={i}
                  variants={fadeInUp}
                  className="p-10 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:border-primary/30 hover:bg-white/[0.05] transition-all group"
                >
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-4">{feature.title}</h3>
                  <p className="text-white/40 leading-relaxed font-medium">{feature.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Pricing/Room Plans Section */}
        <section id="pricing" className="py-32 bg-[#0c0c0c] relative">
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase mb-6">Nuestras <span className="text-primary">Tarifas</span></h2>
              <p className="text-white/50 text-xl max-w-2xl mx-auto">Planes flexibles diseñados para su comodidad y privacidad. Elija la opción que mejor se adapte a su momento.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  name: "Sencilla",
                  price: "$20",
                  period: "Desde 1 hora",
                  features: ["Cama Matrimonial", "Wi-Fi Gratuito", "TV con Cable", "Baño Privado"],
                  plans: [
                    { label: "1 Hora", price: "$20" },
                    { label: "3 Horas", price: "$55" },
                    { label: "Día Completo", price: "$100" }
                  ],
                  highlight: false
                },
                {
                  name: "Doble",
                  price: "$25",
                  period: "Desde 1 hora",
                  features: ["2 Camas Matrimoniales", "Espacio Amplio", "TV Pantalla Plana", "Aire Acondicionado"],
                  plans: [
                    { label: "1 Hora", price: "$25" },
                    { label: "Día Completo", price: "$150" },
                    { label: "Semana", price: "$800" }
                  ],
                  highlight: true
                },
                {
                  name: "Suite",
                  price: "$40",
                  period: "Desde 1 hora",
                  features: ["Cama King Size", "Jacuzzi Privado", "Minibar", "Sonido Premium"],
                  plans: [
                    { label: "1 Hora", price: "$40" },
                    { label: "10 Horas", price: "$350" },
                    { label: "2 Días", price: "$600" }
                  ],
                  highlight: false
                }
              ].map((tier, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className={`relative p-10 rounded-[2.5rem] border ${tier.highlight ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/10' : 'border-white/5 bg-white/[0.02]'} flex flex-col`}
                >
                  {tier.highlight && (
                    <div className="absolute top-0 right-10 -translate-y-1/2 bg-primary text-black text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
                      Más Popular
                    </div>
                  )}
                  
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-2">{tier.name}</h3>
                  <div className="flex items-baseline gap-1 mb-8">
                    <span className="text-5xl font-black">{tier.price}</span>
                    <span className="text-white/40 text-sm font-bold uppercase tracking-widest">{tier.period}</span>
                  </div>

                  <div className="space-y-4 mb-10 flex-grow">
                    {tier.features.map((feat, j) => (
                      <div key={j} className="flex items-center gap-3 text-white/60 text-sm font-medium">
                        <Star className="h-3 w-3 text-primary fill-primary" />
                        {feat}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-8 border-t border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-4">Planes Disponibles</span>
                    {tier.plans.map((plan, k) => (
                      <div key={k} className="flex justify-between items-center bg-white/[0.03] p-4 rounded-2xl border border-white/5 group hover:border-primary/50 transition-colors">
                        <span className="text-sm font-bold text-white/80">{plan.label}</span>
                        <span className="text-sm font-black text-primary">{plan.price}</span>
                      </div>
                    ))}
                  </div>

                  <Button 
                    onClick={() => setIsReservationModalOpen(true)}
                    className={`w-full mt-10 h-14 rounded-2xl font-black uppercase tracking-widest text-xs ${tier.highlight ? 'bg-primary hover:bg-primary/90 text-black' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}
                  >
                    Consultar Disponibilidad
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Highlight Image Section */}
        <section className="py-20 relative overflow-hidden">
          <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
            <motion.div 
               initial={{ opacity: 0, x: -50 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 1 }}
               className="relative rounded-[3rem] overflow-hidden aspect-square shadow-2xl"
            >
              <Image 
                src="/motel_premium_room_1773958120043.png" 
                alt="Luxury Room" 
                fill 
                className="object-cover hover:scale-110 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-10 left-10 right-10">
                 <div className="flex gap-4 mb-4">
                    <Wifi className="h-5 w-5 text-primary" />
                    <Coffee className="h-5 w-5 text-primary" />
                    <Tv className="h-5 w-5 text-primary" />
                 </div>
                 <h4 className="text-3xl font-black uppercase italic tracking-tighter">Habitaciones Suite</h4>
              </div>
            </motion.div>

            <div className="space-y-10">
              <div className="inline-block px-4 py-1.5 bg-primary/20 rounded-full border border-primary/30">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Nuestras Amenidades</span>
              </div>
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter italic uppercase leading-none">Diseño que <br /> <span className="text-primary italic">Inspira</span></h2>
              <div className="grid sm:grid-cols-2 gap-8">
                 <div className="space-y-4 border-l-2 border-primary/20 pl-6">
                    <span className="text-4xl font-black text-primary/40 block">01</span>
                    <h5 className="text-xl font-bold uppercase tracking-tight">Jacuzzi Privado</h5>
                    <p className="text-sm text-white/50">Sistemas de hidromasaje modernos para una relajación total en pareja.</p>
                 </div>
                 <div className="space-y-4 border-l-2 border-primary/20 pl-6">
                    <span className="text-4xl font-black text-primary/40 block">02</span>
                    <h5 className="text-xl font-bold uppercase tracking-tight">Menú Gourmet</h5>
                    <p className="text-sm text-white/50">Carta exclusiva de snacks y bebidas premium entregadas a su habitación.</p>
                 </div>
                 <div className="space-y-4 border-l-2 border-primary/20 pl-6">
                    <span className="text-4xl font-black text-primary/40 block">03</span>
                    <h5 className="text-xl font-bold uppercase tracking-tight">Smart Controls</h5>
                    <p className="text-sm text-white/50">Controle iluminación, música y temperatura desde su dispositivo.</p>
                 </div>
                 <div className="space-y-4 border-l-2 border-primary/20 pl-6">
                    <span className="text-4xl font-black text-primary/40 block">04</span>
                    <h5 className="text-xl font-bold uppercase tracking-tight">Camas King</h5>
                    <p className="text-sm text-white/50">Lencería de alta densidad de hilos para el descanso que merece.</p>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* Gallery section Placeholder */}
        <section id="gallery" className="py-32 bg-[#080808]">
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase mb-6">Explore <span className="text-primary">lujo</span></h2>
              <div className="w-20 h-1 bg-primary mx-auto rounded-full" />
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[400px]">
              <div className="lg:col-span-2 relative rounded-[2rem] overflow-hidden group">
                  <Image src="/motel_exterior_night_1773958134736.png" alt="Exterior" fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
              </div>
              <div className="relative rounded-[2rem] overflow-hidden group">
                  <Image src="/motel_premium_room_1773958120043.png" alt="Room" fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="relative rounded-[2rem] overflow-hidden group">
                  <Image src="/motel_amenities_sparkling_pool_1773958148851.png" alt="Pool" fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="lg:col-span-2 relative rounded-[2rem] overflow-hidden group">
                  <Image src="https://picsum.photos/seed/luxury4/1200/800" alt="Mood" fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="outline" className="rounded-full border-white text-white hover:bg-white hover:text-black font-black uppercase tracking-widest text-[10px]">Cargar Más Imágenes</Button>
                  </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA section */}
        <section className="py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary opacity-5 mix-blend-overlay" />
          <div className="container mx-auto px-6 relative z-10">
            <div className="bg-gradient-to-br from-white/10 to-transparent border border-white/10 p-12 md:p-24 rounded-[4rem] text-center backdrop-blur-xl">
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter italic uppercase mb-10 leading-none">
                ¿Listo para una <br /> <span className="text-primary">Experiencia Inolvidable?</span>
              </h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                <Button 
                  onClick={() => setIsReservationModalOpen(true)}
                  size="lg" 
                  className="h-16 px-12 rounded-full bg-primary hover:bg-primary/90 text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary/40 group text-black"
                >
                  Hacer mi Reserva <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform text-black" />
                </Button>
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-4">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-12 h-12 rounded-full border-4 border-[#0a0a0a] bg-muted overflow-hidden">
                        <Image src={`https://i.pravatar.cc/100?u=${i}`} alt="Avatar" width={48} height={48} />
                      </div>
                    ))}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">Más de 5,000 visitas</div>
                    <div className="text-[10px] text-white/40 font-black uppercase tracking-widest flex items-center gap-1">
                      Privacidad Garantizada <ShieldCheck className="h-3 w-3 text-green-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="contact" className="py-20 border-t border-white/5 bg-black">
        <div className="container mx-auto px-6 grid md:grid-cols-2 lg:grid-cols-4 gap-16">
          <div className="space-y-8">
            <Link href="/" className="flex items-center gap-3">
              <AppLogo className="h-8 w-8 text-primary" />
              <span className="text-xl font-black tracking-tighter uppercase italic">Motel Tres Hermanos</span>
            </Link>
            <p className="text-white/40 font-medium leading-relaxed">
              El motel líder en Costa Rica, ofreciendo experiencias de lujo y privacidad desde hace más de 15 años.
            </p>
            <div className="flex gap-4">
              <Link href="#" className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-primary hover:border-primary transition-all shadow-lg" id="footer-ig">
                <Instagram className="h-5 w-5" />
              </Link>
              <Link href="#" className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-primary hover:border-primary transition-all shadow-lg" id="footer-fb">
                <Facebook className="h-5 w-5" />
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-white/30">Navegación</h4>
            <ul className="space-y-4">
              <li><Link href="#" className="text-white/60 hover:text-white transition-colors">Inicio</Link></li>
              <li><Link href="#features" className="text-white/60 hover:text-white transition-colors">Habitaciones</Link></li>
              <li><Link href="#gallery" className="text-white/60 hover:text-white transition-colors">Galería</Link></li>
              <li><Link href="/login" className="text-white/60 hover:text-white transition-colors">Personal</Link></li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-white/30">Privacidad</h4>
            <ul className="space-y-4">
              <li><Link href="#" className="text-white/60 hover:text-white transition-colors">Términos de Uso</Link></li>
              <li><Link href="#" className="text-white/60 hover:text-white transition-colors">Política de Privacidad</Link></li>
              <li><Link href="#" className="text-white/60 hover:text-white transition-colors">Cookies</Link></li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-white/30">Ubicación</h4>
            <p className="text-white/60 flex items-start gap-4">
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              San José, Costa Rica. <br />
              Del cruce de Escazú 2km Sur.
            </p>
            <p className="text-white/60 flex items-center gap-4">
              <Phone className="h-5 w-5 text-primary shrink-0" />
              +506 2222-2222
            </p>
          </div>
        </div>
        <div className="mt-20 pt-10 border-t border-white/5 text-center text-[10px] font-black uppercase tracking-[0.5em] text-white/20">
          © 2026 Motel Tres Hermanos - Todos los derechos reservados.
        </div>
      </footer>

      <ReservationModal 
        isOpen={isReservationModalOpen} 
        onOpenChange={setIsReservationModalOpen} 
      />
    </div>
  );
}
