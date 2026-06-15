'use client';

import TutorialManager from '@/components/dashboard/TutorialManager';
import { ChevronLeft, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Tutorial } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function ManageTutorialsPage() {
    const { firestore } = useFirebase();

    const tutorialsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'tutorials'), orderBy('order', 'asc'));
    }, [firestore]);

    const { data: tutorials, isLoading } = useCollection<Tutorial>(tutorialsQuery);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#050505] p-6 lg:p-12 space-y-12">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] p-6 lg:p-12 space-y-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-[1600px] mx-auto">
                <div className="space-y-2">
                    <Link href="/manual/project-docs" className="group flex items-center gap-2 mb-4 hover:translate-x-1 transition-transform" data-testid="manage-back-link">
                        <ChevronLeft className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-white transition-colors">Volver a Documentación</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-2xl shadow-primary/10">
                            <GraduationCap className="h-8 w-8 text-primary shadow-glow" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic text-white flex items-center gap-3">
                                Centro de <span className="text-primary italic border-b-4 border-primary/30">Aprendizaje</span>
                            </h1>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Panel Administrativo de Recursos Educativos</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto">
                <TutorialManager initialTutorials={tutorials || []} />
            </main>
        </div>
    );
}
