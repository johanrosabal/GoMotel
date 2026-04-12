import Image from 'next/image';
import { CalendarPlus } from 'lucide-react';
import ReservationsClientPage from '@/components/reservations/ReservationsClientPage';

export default function ReservationsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
            <Image
                src="/login_register_bg.png"
                alt="Background"
                fill
                className="object-cover opacity-20 scale-105"
                priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505] opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-[#050505] opacity-90" />
        </div>

        <div className="container relative z-10 py-12 lg:py-20 space-y-12 max-w-7xl">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-12">
                <div className="space-y-4">
                    <div className="flex items-center gap-4 group">
                        <div className="h-16 w-16 bg-primary/10 rounded-[2rem] flex items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform">
                            <CalendarPlus className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase italic tracking-tighter leading-none flex flex-wrap gap-x-4 items-baseline">
                                <span className="text-white">Gestión de</span>
                                <span className="text-primary">Reservaciones</span>
                            </h1>
                        </div>
                    </div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] max-w-xl pl-2 blur-[0.4px]">
                        Central de control para la administración estratégica de estancias futuras.
                    </p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[3rem] p-4 sm:p-8 lg:p-12 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />
                
                <div className="relative z-10">
                    <ReservationsClientPage />
                </div>
            </div>
        </div>
    </div>
  );
}
