'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { confirmRoomCheckin, getRoomById, getStayById } from '@/lib/actions/room.actions';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Loader2, Sparkles, AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function RoomCheckInPage() {
    const params = useParams();
    const roomId = params.roomId as string;
    
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already_confirmed'>('loading');
    const [roomInfo, setRoomInfo] = useState<{ number: string; guestName?: string } | null>(null);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!roomId) return;

        const performCheckIn = async () => {
            try {
                const room = await getRoomById(roomId);
                if (!room) {
                    setStatus('error');
                    setErrorMessage('La habitación no fue encontrada.');
                    return;
                }

                if (room.status !== 'Occupied') {
                    setStatus('error');
                    setErrorMessage('Esta habitación no registra una estancia activa en este momento.');
                    return;
                }

                if (room.isClientConfirmed) {
                    setRoomInfo({ number: room.number });
                    setStatus('already_confirmed');
                    return;
                }

                // Fetch stay info for personalization
                let guestName = '';
                if (room.currentStayId) {
                    const stay = await getStayById(room.currentStayId);
                    if (stay) guestName = stay.guestName;
                }
                setRoomInfo({ number: room.number, guestName });

                const result = await confirmRoomCheckin(roomId);
                if (result.success) {
                    setStatus('success');
                } else {
                    setStatus('error');
                    setErrorMessage(result.error || 'No se pudo confirmar el ingreso.');
                }
            } catch (error) {
                console.error("Check-in error:", error);
                setStatus('error');
                setErrorMessage('Ocurrió un error inesperado al procesar su solicitud.');
            }
        };

        performCheckIn();
    }, [roomId]);

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background cinematic glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="w-full max-w-md relative z-10 text-center space-y-8">
                <header className="space-y-2">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase text-primary drop-shadow-2xl">
                        HOTEL DU MANOLO
                    </h2>
                    <div className="h-0.5 w-16 bg-primary/50 mx-auto rounded-full" />
                </header>

                <AnimatePresence mode="wait">
                    {status === 'loading' && (
                        <motion.div 
                            key="loading"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-[2.5rem] shadow-2xl space-y-6"
                        >
                            <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto opacity-50" />
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold uppercase tracking-widest italic">Verificando</h3>
                                <p className="text-slate-400 text-sm font-medium">Validando su ingreso a la suite...</p>
                            </div>
                        </motion.div>
                    )}

                    {status === 'success' && (
                        <motion.div 
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white/5 backdrop-blur-xl border border-emerald-500/20 p-10 rounded-[2.5rem] shadow-2xl space-y-8"
                        >
                            <div className="relative mx-auto w-24 h-24">
                                <motion.div 
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                    className="absolute inset-0 bg-emerald-500 rounded-full blur-2xl"
                                />
                                <div className="relative bg-emerald-500 h-24 w-24 rounded-full flex items-center justify-center shadow-2xl">
                                    <ShieldCheck className="h-12 w-12 text-white" />
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <h3 className="text-2xl font-black uppercase italic tracking-tight text-white">¡Bienvenido!</h3>
                                <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px]">Ingreso confirmado con éxito</p>
                                <div className="pt-4 border-t border-white/5 mt-4">
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        Hola, <span className="text-white font-bold">{roomInfo?.guestName || 'Estimado Huésped'}</span>. <br/>
                                        Su estancia en la <span className="text-white font-bold">Suite {roomInfo?.number}</span> ha sido verificada.
                                    </p>
                                </div>
                            </div>
                            
                            <Button asChild variant="outline" className="rounded-2xl border-white/10 hover:bg-white/5 font-bold uppercase tracking-widest text-[10px] w-full h-12" data-testid="[roomid]-button-1">
                                <Link href="/" data-testid="[roomid]-link-ir-al-sitio">
                                    <Home className="mr-2 h-4 w-4 text-emerald-400" />
                                    Ir al Sitio Web
                                </Link>
                            </Button>
                        </motion.div>
                    )}

                    {status === 'already_confirmed' && (
                        <motion.div 
                            key="already_confirmed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[2.5rem] shadow-2xl space-y-6"
                        >
                            <Sparkles className="h-12 w-12 text-blue-400 mx-auto" />
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold uppercase italic tracking-tight text-white uppercase">Ya Verificado</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    Su ingreso a la <span className="text-white font-bold">Suite {roomInfo?.number}</span> ya había sido confirmado anteriormente.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {status === 'error' && (
                        <motion.div 
                            key="error"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white/5 backdrop-blur-xl border border-rose-500/20 p-10 rounded-[2.5rem] shadow-2xl space-y-6"
                        >
                            <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto" />
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold uppercase tracking-widest italic text-rose-500">Error</h3>
                                <p className="text-slate-300 text-sm font-medium">{errorMessage}</p>
                            </div>
                            <Button asChild variant="outline" className="rounded-2xl border-white/10 bg-white/5 font-bold uppercase tracking-widest text-[10px] w-full" data-testid="[roomid]-button-2">
                                <Link href="/" data-testid="[roomid]-link-reintentar">Reintentar</Link>
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <footer className="pt-8">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 italic">
                        Cinematic Luxury Experience
                    </p>
                </footer>
            </div>
        </div>
    );
}
