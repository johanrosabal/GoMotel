'use client';

import { useEffect, useState } from 'react';
import { getTutorials } from '@/lib/actions/tutorial.actions';
import { cn } from '@/lib/utils';
import { VideoPlayer } from '@/components/dashboard/VideoPlayer';
import {
    BookOpen,
    GraduationCap,
    Play,
    ChevronRight,
    Search,
    MonitorPlay,
    Info
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { Tutorial } from '@/types';
import { useUserProfile } from '@/hooks/use-user-profile';
import { motion, AnimatePresence } from 'framer-motion';

export default function LearningCenterPage() {
    const { userProfile, isLoading: isProfileLoading } = useUserProfile();
    const [tutorials, setTutorials] = useState<Tutorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        async function fetchTutorials() {
            const data = await getTutorials();
            const userRole = userProfile?.role;
            const filtered = data.filter(t => {
                const allowed = t.allowedRoles || [];
                // Si está marcado como Público o no tiene roles asignados, es visible para todos
                if (allowed.includes('Público') || allowed.length === 0) return true;
                // De lo contrario, solo si el usuario está logueado y su rol está permitido
                return userRole && allowed.includes(userRole);
            });
            setTutorials(filtered);
            if (filtered.length > 0) setSelectedTutorial(filtered[0]);
            setLoading(false);
        }
        if (!isProfileLoading) {
            fetchTutorials();
        }
    }, [isProfileLoading, userProfile]);

    const filteredTutorials = tutorials.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group tutorials by category
    const categories = Array.from(new Set(tutorials.map(t => t.category)));

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-950 p-6 lg:p-12 space-y-8">
                <Skeleton className="h-12 w-1/3" />
                <div className="grid lg:grid-cols-3 gap-8">
                    <Skeleton className="lg:col-span-2 aspect-video rounded-3xl" />
                    <Skeleton className="h-[600px] rounded-3xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Header */}
            <header className="p-6 lg:p-12 pb-0">
                <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-3">
                        <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 uppercase tracking-widest text-[9px] font-black px-3 py-1 rounded-full">
                            Recursos de Soporte
                        </Badge>
                        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic flex items-center gap-4">
                            Centro de <span className="text-primary italic border-b-4 border-primary/30">Aprendizaje</span>
                        </h1>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest max-w-xl leading-relaxed">
                            Tutoriales interactivos y guías paso a paso para dominar todas las funciones de Go Motel.
                        </p>
                    </div>
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar tutoriales..."
                            className="h-12 bg-white/5 border-white/10 rounded-2xl pl-12 text-xs font-bold focus:ring-primary/20 text-white" data-testid="tutorials-search-input"
                        />
                    </div>
                </div>
            </header>

            <main className="p-6 lg:p-12 pt-12 max-w-[1600px] mx-auto grid lg:grid-cols-4 gap-12 items-start">
                {/* Main Content Area */}
                <div className="lg:col-span-3 space-y-8">
                    <AnimatePresence mode="wait">
                        {selectedTutorial ? (
                            <motion.div
                                key={selectedTutorial.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.4 }}
                                className="space-y-8"
                            >
                                <VideoPlayer
                                    url={selectedTutorial.videoUrl}
                                    title={selectedTutorial.title}
                                />

                                <div className="space-y-6 bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-black uppercase tracking-widest py-1 px-4 text-xs rounded-xl">
                                            {selectedTutorial.category}
                                        </Badge>
                                        <span className="text-slate-500 text-[10px] uppercase font-black tracking-widest">
                                            Lección {tutorials.indexOf(selectedTutorial) + 1} de {tutorials.length}
                                        </span>
                                    </div>

                                    <h2 className="text-3xl font-black uppercase italic tracking-tight text-white border-l-4 border-primary pl-6 leading-tight">
                                        {selectedTutorial.title}
                                    </h2>

                                    <div
                                        className="prose prose-invert prose-emerald max-w-none prose-sm sm:prose-base text-slate-300 font-medium leading-relaxed
                                        prose-headings:uppercase prose-headings:italic prose-headings:font-black prose-headings:tracking-tighter prose-headings:text-white
                                        prose-p:mb-6 prose-strong:text-white prose-strong:font-black prose-li:text-slate-400 prose-blockquote:border-primary"
                                        dangerouslySetInnerHTML={{ __html: selectedTutorial.description }}
                                    />
                                </div>
                            </motion.div>
                        ) : (
                            <div className="aspect-video bg-white/5 rounded-3xl flex flex-col items-center justify-center border border-white/10 border-dashed animate-pulse">
                                <MonitorPlay className="h-16 w-16 text-slate-700 mb-4" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500 italic">Seleccione un tutorial para comenzar</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Sidebar Navigation */}
                <aside className="space-y-8 sticky top-12">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-6">
                            <GraduationCap className="h-5 w-5 text-primary" />
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white italic">Plan de Estudios</h3>
                        </div>

                        {categories.length > 0 ? categories.map(cat => (
                            <div key={cat} className="space-y-2">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-2 pl-2 border-l border-slate-800 ml-1">{cat}</p>
                                <div className="space-y-1">
                                    {tutorials.filter(t => t.category === cat).map(tutorial => (
                                        <button
                                            key={tutorial.id}
                                            onClick={() => setSelectedTutorial(tutorial)}
                                            className={cn(
                                                "w-full flex items-start gap-3 p-4 rounded-2xl transition-all duration-300 text-left group",
                                                selectedTutorial?.id === tutorial.id
                                                    ? "bg-primary text-black font-black shadow-lg shadow-primary/20 scale-[1.02]"
                                                    : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                                            )} data-testid="tutorials-action-button"
                                        >
                                            <div className={cn(
                                                "h-6 w-6 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                                selectedTutorial?.id === tutorial.id ? "bg-black/20" : "bg-white/5 group-hover:bg-primary/20"
                                            )}>
                                                <Play className={cn("h-3 w-3", selectedTutorial?.id === tutorial.id ? "fill-current" : "group-hover:text-primary")} />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[11px] font-black uppercase tracking-tight leading-tight line-clamp-2 italic">
                                                    {tutorial.title}
                                                </span>
                                            </div>
                                            {selectedTutorial?.id === tutorial.id && <ChevronRight className="h-4 w-4 ml-auto" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )) : (
                            <div className="bg-white/5 p-8 rounded-2xl border border-dashed border-white/10 text-center">
                                <Info className="h-6 w-6 text-slate-700 mx-auto mb-2" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 italic leading-relaxed">No hay tutoriales cargados en este momento.</p>
                            </div>
                        )}
                    </div>

                    {/* Support Extra Card */}
                    <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 p-6 rounded-[2rem] space-y-4">
                        <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center">
                            <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-white italic">¿Necesita Asistencia Directa?</h4>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Si no encuentra la solución en estos videos, contacte a nuestro equipo de soporte técnico 24/7.</p>
                        <button className="text-[9px] font-black uppercase tracking-[0.2em] text-primary hover:text-white transition-colors flex items-center gap-2" data-testid="tutorials-next-button">
                            CENTRO DE SOPORTE <ChevronRight className="h-3 w-3" />
                        </button>
                    </div>
                </aside>
            </main>
        </div>
    );
}
