'use client';

import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { AboutPageContent } from '@/types';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function AboutPage() {
  const { firestore } = useFirebase();
  
  const contentRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'publicPages', 'about');
  }, [firestore]);
  
  const { data: content, isLoading } = useDoc<AboutPageContent>(contentRef);

  return (
    <div className="min-h-screen bg-background text-foreground dark:bg-[#0a0a0a] dark:text-white transition-colors duration-300">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl py-4 border-b border-border shadow-lg">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group text-sm font-bold uppercase tracking-widest text-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            Volver
          </Link>
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 md:w-10 md:h-10">
              <Image src="/logo_manolo.png" alt="Logo" fill className="object-contain" />
            </div>
            <span className="text-sm md:text-xl font-black tracking-tighter uppercase italic text-foreground hidden sm:block">Hotel Du Manolo</span>
          </div>
        </div>
      </header>

      {content?.heroImageUrl && (
        <div className="relative w-full h-[35vh] md:h-[45vh] min-h-[250px] mt-16 md:mt-[72px]">
          <Image
            src={content.heroImageUrl}
            alt="Quiénes Somos Hero"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>
      )}

      <main className={`container mx-auto px-6 max-w-4xl relative ${content?.heroImageUrl ? 'pt-8 pb-20 md:pt-12 md:pb-24 z-10' : 'py-32 md:py-40'}`}>
        <div className="mb-12 md:mb-16">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase mb-5">
            Quiénes <span className="text-primary">Somos</span>
          </h1>
          <div className="w-20 h-1.5 bg-primary rounded-full shadow-[0_0_10px_var(--tw-shadow-color)] shadow-primary/50" />
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-8 w-1/2 mt-8" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : content?.content ? (
          <div 
            className="prose prose-sm sm:prose-base md:prose-lg dark:prose-invert max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:italic prose-headings:tracking-tight prose-a:text-primary hover:prose-a:text-primary/80 prose-img:rounded-3xl prose-img:shadow-2xl mx-auto"
            dangerouslySetInnerHTML={{ __html: content.content }}
          />
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p>La historia de nuestro motel aún se está escribiendo. Vuelva pronto para conocer más sobre nosotros.</p>
          </div>
        )}
      </main>
    </div>
  );
}
