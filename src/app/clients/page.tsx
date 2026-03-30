import Image from 'next/image';
import { Users } from 'lucide-react';
import ClientsPage from '@/components/clients/ClientsPage';

export default function ClientsRootPage() {
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

        <div className="container relative z-10 py-8 lg:py-12 space-y-12 max-w-7xl">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-12">
                <div className="space-y-4">
                    <div>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase italic tracking-tighter leading-none flex flex-wrap gap-x-4 items-baseline">
                            <span className="text-white">Gestión de</span>
                            <span className="text-primary">Clientes</span>
                        </h1>
                        <p className="mt-4 text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] italic">
                            Central de control para la administración estratégica de huéspedes.
                        </p>
                    </div>
                </div>
            </div>

            <div className="relative z-10">
                <ClientsPage />
            </div>
        </div>
    </div>
  );
}
