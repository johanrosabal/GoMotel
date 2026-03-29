'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
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
  ArrowLeft,
  Wifi,
  Coffee,
  Tv,
  Users,
  Heart,
  CheckCircle,
  Info,
  Twitter,
  Linkedin,
  Trophy,
  Navigation,
  Compass,
  Map as MapIcon,
  MessageCircle,
  X,
  Bell,
  Eye,
  Play
} from 'lucide-react';
import AppLogo from '@/components/AppLogo';
import { Button } from '@/components/ui/button';
import { ReservationModal } from '@/components/ReservationModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useDoc, useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { doc, query, collection, orderBy, where } from 'firebase/firestore';
import type { LandingPageContent, RoomType, AppNotification } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { getActiveNotifications } from '@/lib/actions/notification.actions';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi
} from "@/components/ui/carousel";
import { useEffect } from 'react';

const featureIcons = {
  ShieldCheck,
  Clock,
  Zap,
  Star,
  Heart,
  CheckCircle,
  Info
};



export default function LandingPage() {
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);

  const { user, firestore } = useFirebase();
  const contentRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'landingPageContent', 'main');
  }, [firestore]);

  const roomTypesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'roomTypes'),
      where('showOnLandingPage', '==', true),
      orderBy('code', 'asc')
    );
  }, [firestore]);

  const { data: cmsContent } = useDoc<LandingPageContent>(contentRef);
  const { data: roomTypesData } = useCollection<RoomType>(roomTypesQuery);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [activeAmenityIndex, setActiveAmenityIndex] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeNotifications, setActiveNotifications] = useState<AppNotification[]>([]);
  const [showSplash, setShowSplash] = useState(true);
  const [showAllGallery, setShowAllGallery] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string, type: 'image' | 'video', alt?: string } | null>(null);
  const galleryImages = cmsContent?.gallerySection?.images || [
    { id: '1', url: "/motel_exterior_night_1773958134736.png", alt: 'Exterior' },
    { id: '2', url: "/motel_premium_room_1773958120043.png", alt: 'Room' },
    { id: '3', url: "/motel_amenities_sparkling_pool_1773958148851.png", alt: 'Pool' },
    { id: '4', url: 'https://picsum.photos/seed/luxury4/1200/800', alt: 'Mood' },
  ];
  const galleryVideos = cmsContent?.gallerySection?.videos || [];

  // Combine images and videos for the preview, limited to 4 items
  const allGalleryMedia = [
    ...galleryImages.map(img => ({ ...img, type: 'image' as const })),
    ...galleryVideos.map(vid => ({ ...vid, type: 'video' as const }))
  ].slice(0, 4);

  useEffect(() => {
    // Hide splash after 2.8s total
    const timer = setTimeout(() => setShowSplash(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showSplash) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [showSplash]);

  useEffect(() => {
    async function fetchNotifs() {
      const notifs = await getActiveNotifications('Public');
      setActiveNotifications(notifs);
    }
    fetchNotifs();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  const tiers = useMemo(() => {
    if (!roomTypesData || roomTypesData.length === 0) return [];

    return roomTypesData.map((rt) => {
      const mainPlan = rt.pricePlans?.[0];
      return {
        name: rt.name,
        price: mainPlan ? formatCurrency(mainPlan.price) : 'N/A',
        period: mainPlan ? `DESDE ${mainPlan.name}` : '',
        features: rt.features || [],
        plans: (rt.pricePlans || []).map(p => ({
          label: p.name,
          price: formatCurrency(p.price)
        }))
      };
    });
  }, [roomTypesData]);

  // CMS dynamic content fallbacks
  const featuresTitle1 = cmsContent?.featuresSection?.title1 || "POR QUÉ SOMOS";
  const featuresTitle2 = cmsContent?.featuresSection?.title2 || "DIFERENTES";
  const featuresDesc = cmsContent?.featuresSection?.description || "Cada detalle ha sido curado para garantizar una experiencia de clase mundial, donde su privacidad es nuestra prioridad número uno.";
  const featuresList = cmsContent?.featuresSection?.features || [
    { id: '3', icon: 'Zap', title: 'CONFORT PREMIUM', description: 'Habitaciones equipadas con tecnología de punta, climatización inteligente y sistemas de sonido de alta fidelidad.' },
  ];

  const amenitiesTitle1 = cmsContent?.amenitiesSection?.title1 || "DISEÑO QUE";
  const amenitiesTitle2 = cmsContent?.amenitiesSection?.title2 || "INSPIRA";
  const amenitiesList = cmsContent?.amenitiesSection?.amenities || [
    { id: '1', title: 'Jacuzzi Privado', description: 'Sistemas de hidromasaje modernos para una relajación total en pareja.' },
    { id: '2', title: 'Menú Gourmet', description: 'Carta exclusiva de snacks y bebidas premium entregadas a su habitación.' },
    { id: '3', title: 'Smart Controls', description: 'Controle iluminación, música y temperatura desde su dispositivo.' },
    { id: '4', title: 'Camas King', description: 'Lencería de alta densidad de hilos para el descanso que merece.' },
  ];

  const amenityPlaceholders = [
    "/motel_premium_room_1773958120043.png",
    "/motel_amenities_sparkling_pool_1773958148851.png",
    "/motel_exterior_night_1773958134736.png",
    "/motel_premium_room_1773958120043.png",
  ];

  const heroMobileImage = cmsContent?.heroSection?.mobileImageUrl || "/hero_bg_mural.png";
  const heroDesktopImage = cmsContent?.heroSection?.desktopImageUrl || "/hotel_du_manolo_hero.jpg";
  const heroTitle1 = cmsContent?.heroSection?.title1 || "Exclusividad";
  const heroTitle2 = cmsContent?.heroSection?.title2 || "Sin Límites";
  const heroDesktopSubtitle = cmsContent?.heroSection?.desktopSubtitle || "Discreción absoluta y confort premium.";
  const heroMobileSubtitle = cmsContent?.heroSection?.mobileSubtitle || "Confort premium.";

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8 }
  };

  const galleryTitle1 = cmsContent?.gallerySection?.title1 || "EXPLORE";
  const galleryTitle2 = cmsContent?.gallerySection?.title2 || "LUJO";

  const aboutPillText = cmsContent?.aboutSection?.pillText || "Nuestra Historia";
  const aboutTitle1 = cmsContent?.aboutSection?.title1 || "MÁS DE 15 AÑOS DE";
  const aboutTitle2 = cmsContent?.aboutSection?.title2 || "EXCELENCIA";
  const aboutDesc = cmsContent?.aboutSection?.description || "Descubra por qué Hotel Du Manolo es el referente de privacidad y lujo en Costa Rica. Una historia construida sobre la pasión por los detalles y la discreción absoluta.";
  const aboutBtnText = cmsContent?.aboutSection?.buttonText || "Conozca Quiénes Somos";

  const footerDescription = cmsContent?.footerSection?.description || "El motel líder en Costa Rica, ofreciendo experiencias de lujo y privacidad desde hace más de 15 años.";
  const footerAddress = cmsContent?.footerSection?.address || "San José, Costa Rica. Del cruce de Escazú 2km Sur.";
  const footerPhone = cmsContent?.footerSection?.phone || "+506 2222-2222";
  const whatsappNumber = cmsContent?.footerSection?.whatsapp || "+506 8888-8888";
  const googleMapsUrl = cmsContent?.footerSection?.googleMapsUrl || "https://www.google.com/maps/place/Hotel+Dumanolo/@9.9940155,-84.1208675,17z/data=!3m1!4b1!4m6!3m5!1s0x8fa0fadcbd8621e1:0xb7a02eafc5c90ebf!8m2!3d9.9940102!4d-84.1182926!16s%2Fg%2F11cm6fkg8p?entry=ttu&g_ep=EgoyMDI2MDMxNy4wIKXMDSoASAFQAw%3D%3D";

  const socialLinks = cmsContent?.footerSection?.socialMedia || [
    { platform: 'Instagram', url: '#' },
    { platform: 'Facebook', url: '#' },
  ];

  const socialIcons = {
    Instagram: Instagram,
    Facebook: Facebook,
    Twitter: Twitter,
    TikTok: Trophy, // Lucide doesn't have a TikTok icon in some versions, using Trophy or another
    LinkedIn: Linkedin,
  };

  // Extract coordinates for Waze
  const wazeUrl = useMemo(() => {
    if (!googleMapsUrl) return null;
    const match = googleMapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
      return `https://waze.com/ul?ll=${match[1]},${match[2]}&navigate=yes`;
    }
    return null;
  }, [googleMapsUrl]);

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

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground dark:bg-[#0a0a0a] dark:text-white selection:bg-primary/30 selection:text-white overflow-x-hidden transition-colors duration-300">
      <AnimatePresence mode="wait">
        {showSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{
              opacity: 0,
              scale: 1.1,
              filter: "blur(20px)",
              transition: { duration: 1.2, ease: [0.43, 0.13, 0.23, 0.96] }
            }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 overflow-hidden"
          >
            {/* Ambient Background Glow */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.3, scale: 1.2 }}
              transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
              className="absolute w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px]"
            />

            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="relative flex flex-col items-center gap-8"
            >
              <div className="relative w-24 h-24 md:w-32 md:h-32 mb-4">
                <Image
                  src="/logo_manolo.png"
                  alt="Hotel Du Manolo Logo"
                  fill
                  className="object-contain drop-shadow-[0_0_25px_rgba(179,153,255,0.4)]"
                  priority
                />
              </div>

              <div className="flex flex-col items-center gap-2">
                <motion.h1
                  initial={{ opacity: 0, letterSpacing: '0.4em' }}
                  animate={{ opacity: 1, letterSpacing: '0.2em' }}
                  transition={{ delay: 0.4, duration: 1.2, ease: "easeOut" }}
                  className="text-2xl md:text-5xl font-black uppercase italic tracking-[0.2em] text-white"
                >
                  Hotel Du Manolo
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{ delay: 0.8, duration: 1 }}
                  className="text-[10px] md:text-xs font-black uppercase tracking-[0.5em] text-primary"
                >
                  Exclusividad & Discreción
                </motion.p>
              </div>

              {/* Progress Bar Container */}
              <div className="mt-8 relative w-48 md:w-64 h-[1px] bg-white/10 overflow-hidden rounded-full">
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "0%" }}
                  transition={{
                    duration: 2.5,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent"
                />
              </div>
            </motion.div>

            {/* Bottom Status */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 1 }}
              className="absolute bottom-12 flex items-center gap-3"
            >
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-white/30 italic">
                Cargando Experiencia...
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeNotifications.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={cn(
              "fixed top-0 left-0 right-0 z-[60] py-2 px-4 text-center text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 transition-colors",
              activeNotifications[0].priority === 'High' ? "bg-red-600 text-white" :
                activeNotifications[0].priority === 'Medium' ? "bg-amber-500 text-black" :
                  "bg-primary text-primary-foreground"
            )}
          >
            <div className="flex-1 flex items-center justify-center gap-2">
              <Bell className="h-3 w-3 animate-bounce" />
              <span>{activeNotifications[0].title}: {activeNotifications[0].message}</span>
            </div>
            <button
              onClick={() => setActiveNotifications([])}
              className="p-1 hover:bg-black/10 rounded-full transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className={cn(
        "fixed left-0 right-0 z-50 transition-all duration-500",
        activeNotifications.length > 0 ? "top-8 md:top-[34px]" : "top-0",
        isScrolled ? "bg-background/80 backdrop-blur-xl py-2 border-b border-border shadow-lg" : "bg-transparent py-4"
      )}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between relative">
          {/* Logo Central en Mobile, Izquierda en Desktop */}
          <Link
            href="/"
            className="flex items-center gap-2 group absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0"
            id="landing-logo"
          >
            <div className="relative w-8 h-8 md:w-12 md:h-12 transition-transform group-hover:scale-110">
              <Image
                src="/logo_manolo.png"
                alt="Hotel Du Manolo Logo"
                fill
                className="object-contain"
              />
            </div>
            <span className={`text-sm md:text-2xl font-black tracking-tighter uppercase italic transition-colors ${isScrolled ? 'text-foreground' : 'text-white shadow-sm'}`}>Hotel Du Manolo</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 ml-auto mr-12">
            <Link href="#features" className="text-sm font-bold uppercase tracking-widest text-white/80 hover:text-white">Características</Link>
            <Link href="#pricing" className="text-sm font-bold uppercase tracking-widest text-white/80 hover:text-white">Tarifas</Link>
            <Link href="#gallery" className="text-sm font-bold uppercase tracking-widest text-white/80 hover:text-white">Galería</Link>
            <Link href="#contact" className="text-sm font-bold uppercase tracking-widest text-white/80 hover:text-white">Contacto</Link>
          </nav>

          <div className="flex items-center gap-4 ml-auto md:ml-0">
            <ThemeToggle className={isScrolled ? 'text-foreground hover:bg-black/5' : 'text-white'} />
            <Link href="/dashboard" className="hidden sm:block text-[10px] md:text-sm font-black uppercase tracking-widest text-white/80 hover:text-white">Dashboard</Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative h-[100dvh] min-h-[100dvh] bg-black overflow-hidden flex flex-col items-center">
          <div className="absolute inset-0 z-0 flex items-center justify-center">
            <Image
              src={heroMobileImage}
              alt="Hotel Du Manolo Hero Mobile"
              fill
              className="object-contain opacity-70 brightness-[0.5] md:hidden"
              priority
            />
            <Image
              src={heroDesktopImage}
              alt="Hotel Du Manolo Hero Desktop"
              fill
              className="object-cover opacity-70 brightness-[0.5] hidden md:block"
              priority
            />
            {/* Logo a un lado (Desktop only) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="hidden md:block absolute top-40 right-12 w-28 h-28 z-20 pointer-events-none"
            >
              <Image
                src="/logo_manolo.png"
                alt="Hotel Du Manolo Logo"
                fill
                className="object-contain drop-shadow-2xl opacity-80"
              />
            </motion.div>
          </div>

          {/* Contenido Hero - Bottom Aligned on Mobile */}
          <div className="absolute bottom-20 md:bottom-auto md:top-1/2 md:-translate-y-1/2 left-0 w-full z-10">
            <div className="container mx-auto px-6 text-center md:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="max-w-xl md:max-w-2xl mx-auto md:mx-0 mb-6 md:mb-10"
              >
                <h1 className="text-2xl md:text-6xl font-black tracking-tighter italic uppercase mb-2 md:mb-6 leading-[0.9] text-white drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
                  {heroTitle1} <br />
                  <span className="text-primary italic">{heroTitle2}</span>
                </h1>
                <p className="hidden md:block text-md text-white/90 font-medium leading-relaxed balance drop-shadow-md">
                  {heroDesktopSubtitle}
                </p>
                <p className="md:hidden text-sm max-w-[80%] mx-auto md:mx-0 text-white/90 font-medium leading-relaxed balance drop-shadow-md">
                  {heroMobileSubtitle}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 md:gap-6 scale-90 md:scale-100"
              >
                <Button
                  onClick={() => setIsReservationModalOpen(true)}
                  size="lg"
                  className="bg-[#b399ff] hover:bg-[#a080ff] text-primary text-xs font-black uppercase tracking-widest h-12 md:h-14 px-8 md:px-10 rounded-full shadow-2xl shadow-purple-500/30 flex items-center gap-3 transition-all duration-300 group"
                >
                  Reservar Ahora
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
                <Link href="#gallery">
                  <Button size="lg" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest h-12 md:h-14 px-8 md:px-10 rounded-full backdrop-blur-md transition-all duration-300">
                    Ver Galería
                  </Button>
                </Link>
              </motion.div>
            </div>
          </div>

          <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20 pointer-events-none">
            <div className="flex flex-col items-center gap-1 animate-bounce opacity-70">
              <span className="text-[8px] font-black uppercase tracking-[0.4em] pl-[0.4em] text-white">Scroll</span>
              <div className="w-[1px] h-6 bg-gradient-to-b from-white to-transparent" />
            </div>
          </div>
        </section>

        {/* Features section */}
        <section id="features" className="py-16 bg-muted/30 dark:bg-[#0c0c0c] relative">
          <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-8">
              <div className="max-w-2xl">
                <h2 className="text-5xl md:text-6xl font-black tracking-tighter italic uppercase leading-none mb-6">
                  {featuresTitle1} <br />
                  <span className="text-primary italic">{featuresTitle2}</span>
                </h2>
                <div className="max-w-xl">
                  <p className="text-muted-foreground dark:text-white/50 text-xl font-medium leading-relaxed">
                    {featuresDesc}
                  </p>
                </div>
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
              {featuresList.map((feature, i) => {
                const Icon = featureIcons[feature.icon as keyof typeof featureIcons] || Star;
                return (
                  <motion.div
                    key={feature.id || i}
                    variants={fadeInUp}
                    className="p-10 rounded-[2rem] bg-card dark:bg-white/[0.03] border border-border dark:border-white/5 hover:border-primary/30 hover:bg-accent dark:hover:bg-white/[0.05] transition-all group shadow-sm hover:shadow-xl dark:shadow-none"
                  >
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                      <Icon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-4 group-hover:text-white transition-colors">{feature.title}</h3>
                    <p className="text-muted-foreground dark:text-white/40 leading-relaxed font-medium group-hover:text-white/90 transition-colors">{feature.description}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* Pricing/Room Plans Section */}
        <section id="pricing" className="py-16 bg-muted/30 dark:bg-[#0c0c0c] relative">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase mb-6">Nuestras <span className="text-primary">Tarifas</span></h2>
              <p className="text-muted-foreground dark:text-white/50 text-xl max-w-2xl mx-auto">Planes flexibles diseñados para su comodidad y privacidad. Elija la opción que mejor se adapte a su momento.</p>
            </div>

            <div className="max-w-6xl mx-auto px-4">
              <Carousel
                setApi={setApi}
                opts={{
                  align: "start",
                  loop: false,
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-4 h-full py-10">
                  {tiers.map((tier, i) => {
                    // Highlight the middle item if 3 are visible
                    const isHighlighted = i === current + 1;

                    return (
                      <CarouselItem key={i} className="pl-4 md:basis-1/2 lg:basis-1/3">
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1, duration: 0.5 }}
                          viewport={{ once: true }}
                          className={`relative w-full pl-10 pr-6 py-8 md:p-10 rounded-[2.5rem] border transition-all duration-500 flex flex-col group ${isHighlighted
                            ? 'border-primary bg-primary/[0.07] shadow-[0_0_50px_-12px_rgba(179,153,255,0.3)] scale-105 z-10'
                            : 'border-border dark:border-white/5 bg-card dark:bg-white/[0.02] hover:bg-accent dark:hover:bg-white/[0.04] scale-95 shadow-sm dark:shadow-none'
                            }`}
                        >
                          {isHighlighted && (
                            <div className="absolute top-0 right-10 -translate-y-1/2 bg-primary text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-primary/20">
                              Más Popular
                            </div>
                          )}

                          <h3 className="text-xl sm:text-3xl font-black uppercase italic tracking-tighter mb-4 leading-tight">{tier.name}</h3>
                          <div className="flex flex-col gap-1 mb-8">
                            <span className="text-2xl sm:text-4xl md:text-5xl font-black leading-none whitespace-nowrap">{tier.price}</span>
                            <span className="text-muted-foreground dark:text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mt-1 bg-gray-200 dark:bg-white/5 py-1 px-3 rounded-md w-fit border border-border dark:border-white/5">
                              {tier.period}
                            </span>
                          </div>
                          <div className="space-y-4 mb-10 flex-grow">
                            {tier.features.map((feat, j) => {
                              const f = feat.toLowerCase();
                              let Icon = Star;
                              if (f.includes('wifi') || f.includes('wi-fi')) Icon = Wifi;
                              if (f.includes('tv') || f.includes('cable') || f.includes('netflix')) Icon = Tv;
                              if (f.includes('cama')) Icon = Users;
                              if (f.includes('baño') || f.includes('privado')) Icon = ShieldCheck;

                              return (
                                <div key={j} className={`flex items-center gap-3 transition-colors text-sm font-medium ${isHighlighted ? 'text-primary' : 'text-muted-foreground dark:text-white/60 group-hover:text-white'}`}>
                                  <div className="relative">
                                    <Icon className={`h-4 w-4 ${isHighlighted ? 'text-primary' : 'text-primary'}`} />
                                    {(f.includes('netflix') || f.includes('tv')) && (
                                      <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-black rounded-full flex items-center justify-center border-[0.5px] border-white/20">
                                        <span className="text-[5px] font-black text-[#E50914]">N</span>
                                      </div>
                                    )}
                                  </div>
                                  {feat.replace('Preimium', 'Premium')}
                                </div>
                              );
                            })}
                          </div>

                          <div className="space-y-3 pt-8 border-t border-border dark:border-white/5 mt-auto">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-white/30 block mb-2">Planes Disponibles</span>
                            {(tier.plans || []).map((plan, k) => (
                              <div key={k} className="flex justify-between items-center bg-foreground/5 dark:bg-white/[0.03] p-3 rounded-xl border border-border dark:border-white/5 group hover:border-primary/50 transition-colors">
                                <span className="text-xs font-bold text-foreground/80 dark:text-white/80">{plan.label}</span>
                                <span className="text-xs font-black text-primary">{plan.price}</span>
                              </div>
                            ))}
                          </div>

                          <Button
                            onClick={() => setIsReservationModalOpen(true)}
                            className={`w-full mt-10 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] ${isHighlighted
                              ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20'
                              : 'bg-background hover:bg-accent text-foreground border border-border dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10'
                              }`}
                          >
                            Consultar Disponibilidad
                          </Button>
                        </motion.div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>

                {tiers.length > 1 && (
                  <>
                    {/* Mobile Navigation Arrows (Side Overlay) */}
                    <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 pointer-events-none z-50 md:hidden">
                      <button
                        onClick={() => api?.scrollPrev()}
                        className={`w-12 h-12 rounded-full border border-primary/20 flex items-center justify-center transition-all active:scale-95 shadow-2xl pointer-events-auto ${api ? (api.canScrollPrev() ? 'bg-primary text-white' : 'bg-black/60 text-white/20 border-white/5 cursor-not-allowed') : 'bg-primary/20 text-white'}`}
                        aria-label="Anterior"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => api?.scrollNext()}
                        className={`w-12 h-12 rounded-full border border-primary/20 flex items-center justify-center transition-all active:scale-95 shadow-2xl pointer-events-auto ${api ? (api.canScrollNext() ? 'bg-primary text-white' : 'bg-black/60 text-white/20 border-white/5 cursor-not-allowed') : 'bg-primary/20 text-white'}`}
                        aria-label="Siguiente"
                      >
                        <ArrowRight className="h-5 w-5" />
                      </button>
                    </div>

                    <CarouselPrevious className="-left-16 hidden md:flex border-white/10 hover:bg-white/10 text-white" />
                    <CarouselNext className="-right-16 hidden md:flex border-white/10 hover:bg-white/10 text-white" />
                  </>
                )}
              </Carousel>
            </div>
          </div>
        </section>

        {/* Highlight Image Section */}
        <section className="py-10 relative overflow-hidden">
          <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="hidden lg:block relative rounded-[3rem] overflow-hidden aspect-square shadow-2xl bg-black"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeAmenityIndex}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="absolute inset-0"
                >
                  <Image
                    src={amenitiesList[activeAmenityIndex]?.imageUrl || amenityPlaceholders[activeAmenityIndex % amenityPlaceholders.length]}
                    alt={amenitiesList[activeAmenityIndex]?.title || "Amenity"}
                    fill
                    className="object-cover transition-transform duration-[2000ms] hover:scale-110"
                  />
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-10 left-10 right-10 z-10">
                <div className="flex gap-4 mb-4 p-3 bg-primary/20 backdrop-blur-md rounded-2xl border border-primary/10 w-fit">
                  <Wifi className="h-5 w-5 text-primary" />
                  <Coffee className="h-5 w-5 text-primary" />
                  <Tv className="h-5 w-5 text-primary" />
                </div>
                <h4 className="text-3xl font-black uppercase italic tracking-tighter text-white">
                  {amenitiesList[activeAmenityIndex]?.title || "Habitaciones Suite"}
                </h4>
              </div>
            </motion.div>

            <div className="space-y-10">
              <div className="inline-block px-4 py-1.5 bg-primary/20 rounded-full border border-primary/30">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Nuestras Amenidades</span>
              </div>
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter italic uppercase leading-none">
                {amenitiesTitle1} <br />
                <span className="inline-block mt-2 px-4 py-1 bg-primary/20 text-primary italic rounded-2xl border border-primary/10">{amenitiesTitle2}</span>
              </h2>
              <div className="grid sm:grid-cols-2 gap-8">
                {amenitiesList.map((amenity, i) => (
                  <div
                    key={amenity.id || i}
                    className={`space-y-4 border-l-2 pl-6 group cursor-pointer transition-all duration-300 ${activeAmenityIndex === i ? 'border-primary bg-primary/5 py-4 -ml-4 pl-10 rounded-r-2xl' : 'border-primary/10 hover:border-primary/40'}`}
                    onMouseEnter={() => setActiveAmenityIndex(i)}
                  >
                    <div className="lg:hidden relative w-full aspect-video rounded-2xl overflow-hidden mb-6 border border-white/10 shadow-xl">
                      <Image
                        src={amenity.imageUrl || amenityPlaceholders[i % amenityPlaceholders.length]}
                        alt={amenity.title || "Amenity"}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                    <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-2xl font-black border border-primary/10 transition-all duration-300 ${activeAmenityIndex === i ? 'bg-primary text-black scale-110' : 'bg-primary/20 text-primary group-hover:bg-primary/30'}`}>0{i + 1}</span>
                    <h5 className={`text-xl font-bold uppercase tracking-tight transition-colors ${activeAmenityIndex === i ? 'text-primary' : 'text-foreground dark:text-white'}`}>{amenity.title}</h5>
                    <p className={`text-sm transition-colors ${activeAmenityIndex === i ? 'text-foreground/80 dark:text-white/80' : 'text-muted-foreground dark:text-white/50'}`}>{amenity.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Gallery section Placeholder */}
        <section id="gallery" className="py-16 bg-background dark:bg-[#080808]">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase mb-6">{galleryTitle1} <span className="text-primary">{galleryTitle2}</span></h2>
              <div className="w-20 h-1 bg-primary mx-auto rounded-full" />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[400px]">
              {allGalleryMedia.map((item, index) => {
                // Alternating grid logic:
                // Row 1: Span 2, Span 1
                // Row 2: Span 1, Span 2
                const isPairStart = index % 2 === 0;
                const isEvenRow = Math.floor(index / 2) % 2 === 0;
                const colSpan = isEvenRow
                  ? (isPairStart ? 'lg:col-span-2' : 'lg:col-span-1')
                  : (isPairStart ? 'lg:col-span-1' : 'lg:col-span-2');

                return (
                  <motion.div
                    key={item.id || index}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      colSpan,
                      "relative rounded-[2rem] overflow-hidden group border border-white/5 bg-neutral-900/50 cursor-pointer"
                    )}
                    onClick={() => setSelectedMedia({ url: item.url, type: item.type, alt: item.alt })}
                  >
                    {item.type === 'image' ? (
                      <Image
                        src={item.url}
                        alt={item.alt || `Gallery image ${index + 1}`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="relative w-full h-full bg-slate-900 pointer-events-none">
                        <video
                          src={`${item.url}#t=0.1`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                          <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Play className="h-6 w-6 text-primary fill-primary" />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors pointer-events-none" />

                    {item.alt && (
                      <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{item.type === 'video' ? 'VIDEO' : 'EXPLORE'}</p>
                        <p className="text-xs font-black uppercase tracking-widest">{item.alt}</p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-16 flex justify-center"
            >
              <Link href="/gallery">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 px-10 rounded-full font-black uppercase tracking-[0.2em] text-[10px] border-primary/20 hover:border-primary bg-primary/5 hover:bg-primary transition-all duration-300 group shadow-lg"
                >
                  <span className="flex items-center gap-3">
                    Ver galería completa
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
        {/* Quiénes Somos Mini Hero Section */}
        <section className="py-24 relative overflow-hidden bg-muted/20 dark:bg-[#0c0c0c]/80 border-t border-b border-border dark:border-white/5">
          <div className="absolute inset-0 bg-[url('/hotel_du_manolo_hero.jpg')] bg-cover bg-center opacity-5 dark:opacity-10 mix-blend-luminosity pointer-events-none" />
          <div className="container mx-auto px-6 relative z-10 text-center">
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="inline-block px-4 py-1.5 bg-primary/10 rounded-full border border-primary/20">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{aboutPillText}</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase leading-none">
                {aboutTitle1} <br /> <span className="text-primary italic">{aboutTitle2}</span>
              </h2>
              <p className="text-muted-foreground dark:text-white/60 text-lg md:text-xl font-medium leading-relaxed">
                {aboutDesc}
              </p>
              <div className="pt-4">
                <Link href="/quienes-somos">
                  <Button
                    size="lg"
                    className="h-14 px-10 rounded-full bg-primary hover:bg-primary/90 text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20 text-primary-foreground group"
                  >
                    {aboutBtnText} <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA section */}
        <section className="py-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary opacity-5 mix-blend-overlay" />
          <div className="container mx-auto px-6 relative z-10">
            <div className="bg-gradient-to-br from-foreground/5 dark:from-white/10 to-transparent border border-border dark:border-white/10 p-12 md:p-24 rounded-[4rem] text-center backdrop-blur-xl">
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter italic uppercase mb-10 leading-none">
                ¿Listo para una <br /> <span className="text-primary">Experiencia Inolvidable?</span>
              </h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                <Button
                  onClick={() => setIsReservationModalOpen(true)}
                  size="lg"
                  className="h-16 px-12 rounded-full bg-primary hover:bg-primary/90 text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary/40 group text-primary-foreground"
                >
                  Hacer mi Reserva <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-4">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="w-12 h-12 rounded-full border-4 border-[#0a0a0a] bg-muted overflow-hidden">
                        <Image src={`https://i.pravatar.cc/100?u=${i}`} alt="Avatar" width={48} height={48} />
                      </div>
                    ))}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">Más de 5,000 visitas</div>
                    <div className="text-[10px] text-foreground/60 dark:text-white/40 font-black uppercase tracking-widest flex items-center gap-1">
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
      <footer id="contact" className="py-20 border-t border-border dark:border-white/5 bg-background dark:bg-black transition-colors">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[1.5fr_0.8fr_1.5fr] gap-16 md:gap-24 text-center md:text-left">
          <div className="space-y-8 flex flex-col items-center md:items-start">
            <Link href="/" className="flex items-center gap-4 group">
              <div className="relative w-10 h-10 transition-transform group-hover:scale-110">
                <Image
                  src="/logo_manolo.png"
                  alt="Hotel Du Manolo Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-black tracking-tighter uppercase italic">Hotel Du Manolo</span>
            </Link>
            <p className="text-muted-foreground dark:text-white/40 font-medium leading-relaxed max-w-sm">
              {footerDescription}
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social, index) => {
                const Icon = socialIcons[social.platform as keyof typeof socialIcons] || Instagram;
                return (
                  <Link
                    key={index}
                    href={social.url}
                    target="_blank"
                    className="w-12 h-12 rounded-full border border-border dark:border-white/10 flex items-center justify-center hover:bg-primary hover:border-primary transition-all shadow-lg group"
                  >
                    <Icon className="h-5 w-5 text-foreground group-hover:text-primary-foreground transition-colors dark:text-white dark:group-hover:text-black" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="space-y-6 flex flex-col items-center md:items-start">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground dark:text-white/30">Navegación</h4>
            <ul className="space-y-4 text-center md:text-left">
              <li><Link href="/" className="text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white transition-colors">Inicio</Link></li>
              <li><Link href="#features" className="text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white transition-colors">Habitaciones</Link></li>
              <li><Link href="#gallery" className="text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white transition-colors">Galería</Link></li>
              <li><Link href={user ? "/dashboard" : "/login"} className="text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white transition-colors">{user ? "Dashboard" : "Personal"}</Link></li>
            </ul>
          </div>

          <div className="space-y-6 flex flex-col items-center md:items-start">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground dark:text-white/30">Ubicación</h4>
            <p className="text-muted-foreground dark:text-white/60 flex items-start gap-4 text-center md:text-left">
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              {footerAddress}
            </p>
            <a href={`tel:${footerPhone.replace(/\s+/g, '')}`} className="text-muted-foreground dark:text-white/60 flex items-center gap-4 hover:text-primary transition-colors group">
              <Phone className="h-5 w-5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
              {formatPhoneNumber(footerPhone)}
            </a>
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground dark:text-white/60 flex items-center gap-4 hover:text-green-500 transition-colors group"
              >
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <MessageCircle className="h-5 w-5 text-green-500 group-hover:scale-110 transition-transform" />
                </div>
                {formatPhoneNumber(whatsappNumber)}
              </a>
            )}

            <div className="pt-4 flex flex-col gap-3 items-center md:items-start w-full">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-white/30 mb-1">Cómo llegar:</p>
              <div className="flex gap-3 w-full">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-11 px-4 rounded-xl bg-foreground/5 dark:bg-white/5 border border-border dark:border-white/10 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-accent dark:hover:bg-white/10 hover:border-border dark:hover:border-white/20 transition-all group backdrop-blur-sm"
                >
                  <MapIcon className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" /> Google Maps
                </a>
                {wazeUrl && (
                  <a
                    href={wazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-11 px-4 rounded-xl bg-foreground/5 dark:bg-white/5 border border-border dark:border-white/10 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-accent dark:hover:bg-white/10 hover:border-border dark:hover:border-white/20 transition-all group backdrop-blur-sm"
                  >
                    <Navigation className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" /> Waze
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-20 pt-10 pb-32 md:pb-10 border-t border-border dark:border-white/5 text-center text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground dark:text-white/20">
          <div className="max-w-[250px] md:max-w-none mx-auto leading-loose md:leading-normal">
            © 2026 Hotel Du Manolo - Todos los derechos reservados.
          </div>
        </div>
      </footer>

      <ReservationModal
        isOpen={isReservationModalOpen}
        onOpenChange={setIsReservationModalOpen}
        phoneNumber={footerPhone}
        whatsappNumber={whatsappNumber}
      />

      {/* Floating WhatsApp Button */}
      {whatsappNumber && (
        <motion.a
          href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="fixed bottom-4 md:bottom-8 right-8 z-[100] w-16 h-16 bg-green-500 rounded-full shadow-2xl shadow-green-500/40 flex items-center justify-center hover:bg-green-600 transition-colors group"
        >
          <MessageCircle className="h-8 w-8 text-white group-hover:scale-110 transition-transform" />
          <span className="absolute right-full mr-4 bg-black/80 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10">
            Chatea con nosotros
          </span>
        </motion.a>
      )}

      {/* Media Lightbox */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex items-center justify-center px-4 md:px-6"
          >
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute top-4 md:top-8 right-4 md:right-8 w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500 transition-colors z-[210]"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-7xl w-full aspect-video rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border border-white/10"
            >
              {selectedMedia.type === 'image' ? (
                <Image
                  src={selectedMedia.url}
                  alt={selectedMedia.alt || 'View'}
                  fill
                  className="object-contain"
                />
              ) : (
                <div className="w-full h-full bg-black">
                  {selectedMedia.url.includes('youtube.com') || selectedMedia.url.includes('youtu.be') ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${selectedMedia.url.split('v=')[1] || selectedMedia.url.split('/').pop()}`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={selectedMedia.url}
                      controls
                      autoPlay
                      className="w-full h-full"
                    />
                  )}
                </div>
              )}

              <div className="absolute bottom-4 left-4 md:bottom-10 md:left-10 p-4 md:p-6 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl md:rounded-2xl hidden md:block">
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                  {selectedMedia.type === 'image' ? 'Captura Real' : 'Experiencia Visual'}
                </p>
                <h3 className="text-lg md:text-2xl font-black uppercase italic tracking-tighter">
                  {selectedMedia.alt || 'Hotel Du Manolo Experience'}
                </h3>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
