'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Play, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Maximize2,
  X,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { LandingPageContent } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type MediaType = 'all' | 'image' | 'video';

export default function GalleryPage() {
  const [filter, setFilter] = useState<MediaType>('all');
  const [selectedMedia, setSelectedMedia] = useState<{url: string, type: 'image' | 'video', alt?: string} | null>(null);
  
  const { firestore } = useFirebase();
  const contentRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'landingPageContent', 'main');
  }, [firestore]);

  const { data: cmsContent, isLoading } = useDoc<LandingPageContent>(contentRef);

  const galleryImages = cmsContent?.gallerySection?.images || [];
  const galleryVideos = cmsContent?.gallerySection?.videos || [];

  const allMedia = useMemo(() => {
    const images = galleryImages.map(img => ({ ...img, type: 'image' as const }));
    const videos = galleryVideos.map(vid => ({ ...vid, type: 'video' as const }));
    return [...images, ...videos];
  }, [galleryImages, galleryVideos]);

  const filteredMedia = useMemo(() => {
    if (filter === 'all') return allMedia;
    return allMedia.filter(item => item.type === filter);
  }, [allMedia, filter]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30 selection:text-white">
      {/* Premium Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-black/50 backdrop-blur-xl border-b border-white/5 py-4">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-primary transition-colors">
              <ArrowLeft className="h-5 w-5 group-hover:text-black" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.3em] hidden sm:block">Volver al Inicio</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8">
              <Image src="/logo_manolo.png" alt="Logo" fill className="object-contain" />
            </div>
            <h1 className="text-lg font-black italic uppercase tracking-tighter">Galería <span className="text-primary italic">Exclusiva</span></h1>
          </div>

          <div className="w-10 h-10 hidden sm:block" /> {/* Spacing balance */}
        </div>
      </header>

      <main className="pt-32 pb-20 container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-7xl font-black tracking-tighter italic uppercase mb-6 leading-none"
          >
            {cmsContent?.gallerySection?.title1 || "EXPLORE"} <br />
            <span className="text-primary italic">{cmsContent?.gallerySection?.title2 || "LUJO"}</span>
          </motion.h2>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-4"
          >
            {[
              { id: 'all', label: 'Todo', icon: Maximize2 },
              { id: 'image', label: 'Fotos', icon: ImageIcon },
              { id: 'video', label: 'Videos', icon: VideoIcon },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id as MediaType)}
                className={cn(
                  "px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-300 flex items-center gap-2",
                  filter === t.id 
                    ? "bg-primary border-primary text-black shadow-lg shadow-primary/20 scale-105" 
                    : "bg-white/5 border-white/10 text-white/60 hover:border-primary/50"
                )}
              >
                <t.icon className="h-3 w-3" />
                {t.label}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Media Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredMedia.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className={cn(
                  "group relative aspect-[4/5] rounded-[2.5rem] overflow-hidden border border-white/5 cursor-pointer bg-neutral-900",
                  index % 5 === 0 && "md:col-span-2 lg:col-span-2 aspect-video md:aspect-auto"
                )}
                onClick={() => setSelectedMedia({ url: item.url, type: item.type, alt: item.alt })}
              >
                {item.type === 'image' ? (
                  <Image
                    src={item.url}
                    alt={item.alt || 'Gallery item'}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="relative w-full h-full bg-slate-900 pointer-events-none">
                    <video 
                      src={`${item.url}#t=0.1`} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                      <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play className="h-8 w-8 text-primary fill-primary" />
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors pointer-events-none" />
                
                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between pointer-events-none">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/50">{item.type === 'image' ? 'Fotografía' : 'Video'}</p>
                    <h4 className="text-sm font-black uppercase italic tracking-tighter truncate max-w-[200px]">{item.alt || 'Suite Premium'}</h4>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.type === 'image' ? <Maximize2 className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Lightbox / Video Player Overlay */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center px-6"
          >
            <button 
              onClick={() => setSelectedMedia(null)}
              className="absolute top-8 right-8 w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500 transition-colors z-[110]"
            >
              <X className="h-6 w-6" />
            </button>

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-7xl w-full aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white/10"
            >
              {selectedMedia.type === 'image' ? (
                <Image
                  src={selectedMedia.url}
                  alt={selectedMedia.alt || 'Large view'}
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
              
              <div className="absolute bottom-10 left-10 p-6 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl hidden md:block">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{selectedMedia.type === 'image' ? 'Captura Real' : 'Experiencia Visual'}</p>
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">{selectedMedia.alt || 'Hotel Du Manolo Experience'}</h3>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
