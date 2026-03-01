'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Service, ProductCategory, CompanyProfile } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Utensils, Beer, Package, QrCode, Clock } from 'lucide-react';

const CATEGORY_DURATION = 15000; // 15 seconds per category

export default function PublicMenuDisplay() {
    const { firestore } = useFirebase();
    const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: services } = useCollection<Service>(servicesQuery);

    const companyRef = useMemoFirebase(() => 
        firestore ? doc(firestore, 'companyInfo', 'main') : null, 
        [firestore]
    );
    const { data: company } = useDoc<CompanyProfile>(companyRef);

    // Group active services by category
    const groupedMenu = useMemo(() => {
        if (!categories || !services) return [];
        
        return categories.map(cat => {
            const catServices = services.filter(s => s.categoryId === cat.id && s.isActive);
            return {
                ...cat,
                items: catServices
            };
        }).filter(group => group.items.length > 0);
    }, [categories, services]);

    // Handle Rotation Logic
    useEffect(() => {
        if (groupedMenu.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentCategoryIndex((prev) => (prev + 1) % groupedMenu.length);
            setProgress(0);
        }, CATEGORY_DURATION);

        const progressInterval = setInterval(() => {
            setProgress(prev => Math.min(prev + (100 / (CATEGORY_DURATION / 100)), 100));
        }, 100);

        return () => {
            clearInterval(interval);
            clearInterval(progressInterval);
        };
    }, [groupedMenu.length]);

    const currentGroup = groupedMenu[currentCategoryIndex];

    if (!categories || !services) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-black">
                <div className="text-center space-y-4">
                    <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-primary font-black uppercase tracking-[0.3em] text-xs">Cargando Experiencia Digital</p>
                </div>
            </div>
        );
    }

    if (groupedMenu.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-black text-white text-center p-10">
                <div className="max-w-md space-y-6">
                    <Package className="h-20 w-20 mx-auto text-muted-foreground opacity-20" />
                    <h1 className="text-3xl font-black uppercase tracking-tighter">Menú No Disponible</h1>
                    <p className="text-muted-foreground">Por favor, asegúrese de tener productos activos en el catálogo.</p>
                </div>
            </div>
        );
    }

    const featuredImage = currentGroup.items[0]?.imageUrl || "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=1000&auto=format&fit=crop";

    return (
        <div className="h-full w-full flex flex-col relative text-white select-none">
            {/* Top Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5 z-50">
                <div 
                    className="h-full bg-primary transition-all duration-100 ease-linear" 
                    style={{ width: `${progress}%` }} 
                />
            </div>

            {/* Content Body */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Side: Visual Hero */}
                <div className="w-[45%] h-full relative overflow-hidden bg-black border-r border-white/5">
                    <div className="absolute inset-0 animate-in fade-in duration-1000">
                        <img 
                            key={featuredImage}
                            src={featuredImage} 
                            alt="Featured" 
                            className="w-full h-full object-cover opacity-60 scale-110 animate-ken-burns"
                        />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-[#0a0a0a]" />
                    
                    <div className="absolute bottom-16 left-12 right-12 space-y-4 z-10 animate-in slide-in-from-left-8 duration-700">
                        <Badge className="bg-primary text-white font-black px-4 py-1.5 rounded-none uppercase tracking-widest text-sm border-none">
                            Recomendación
                        </Badge>
                        <h2 className="text-6xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">
                            {currentGroup.items[0]?.name}
                        </h2>
                        <p className="text-xl text-primary font-bold tracking-tight">
                            {formatCurrency(currentGroup.items[0]?.price)}
                        </p>
                    </div>
                </div>

                {/* Right Side: Menu List */}
                <div className="flex-1 flex flex-col bg-[#0a0a0a] p-12 lg:p-20 justify-between relative">
                    <div className="animate-in fade-in slide-in-from-right-12 duration-700">
                        <header className="mb-12 flex justify-between items-end border-b border-white/10 pb-8">
                            <div className="space-y-2">
                                <p className="text-primary font-black uppercase tracking-[0.4em] text-xs">Categoría</p>
                                <h1 className="text-7xl font-black uppercase tracking-tighter text-white">
                                    {currentGroup.name}
                                </h1>
                            </div>
                            <div className="text-right">
                                <span className="text-white/20 font-black text-8xl leading-none">
                                    {String(currentCategoryIndex + 1).padStart(2, '0')}
                                </span>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 gap-y-10">
                            {currentGroup.items.slice(0, 8).map((item, idx) => (
                                <div 
                                    key={item.id} 
                                    className="flex justify-between items-start gap-8 group animate-in fade-in slide-in-from-bottom-4"
                                    style={{ animationDelay: `${idx * 100}ms` }}
                                >
                                    <div className="space-y-1.5 flex-1">
                                        <div className="flex items-center gap-4">
                                            <h3 className="text-2xl font-black uppercase tracking-tight group-hover:text-primary transition-colors">
                                                {item.name}
                                            </h3>
                                            <div className="flex-1 border-b border-dashed border-white/10 h-0 mt-4" />
                                        </div>
                                        <p className="text-muted-foreground text-sm font-medium line-clamp-1 max-w-[80%] uppercase tracking-wide opacity-60">
                                            {item.description || "Ingredientes seleccionados de la más alta calidad."}
                                        </p>
                                    </div>
                                    <div className="text-3xl font-black text-primary tracking-tighter pt-1">
                                        {formatCurrency(item.price)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Info Bar */}
                    <footer className="mt-auto pt-12 flex items-center justify-between border-t border-white/10">
                        <div className="flex items-center gap-6">
                            {company?.logoUrl ? (
                                <img src={company.logoUrl} alt="Logo" className="h-12 w-12 object-contain grayscale brightness-200" />
                            ) : (
                                <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                                    <Utensils className="h-6 w-6 text-white" />
                                </div>
                            )}
                            <div className="space-y-0.5">
                                <p className="font-black text-xl tracking-tighter uppercase leading-none">
                                    {company?.tradeName || 'Go Motel'}
                                </p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Gastronomía & Confort</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-10">
                            <div className="flex items-center gap-4 text-muted-foreground">
                                <Clock className="h-5 w-5 text-primary" />
                                <div className="text-[10px] font-black uppercase tracking-widest leading-none">
                                    Servicio<br/>24 Horas
                                </div>
                            </div>
                            <div className="h-12 w-px bg-white/10" />
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Menú en el móvil</p>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Escanea este código</p>
                                </div>
                                <div className="bg-white p-1.5 rounded-lg shadow-2xl">
                                    <QrCode className="h-10 w-10 text-black" />
                                </div>
                            </div>
                        </div>
                    </footer>
                </div>
            </div>

            <style jsx global>{`
                @keyframes ken-burns {
                    0% { transform: scale(1); }
                    100% { transform: scale(1.2); }
                }
                .animate-ken-burns {
                    animation: ken-burns 20s ease-out forwards;
                }
            `}</style>
        </div>
    );
}
