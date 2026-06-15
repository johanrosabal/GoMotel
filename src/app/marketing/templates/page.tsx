'use client';

import { TemplateList } from '@/components/marketing/TemplateList';
import { PageHeader } from '@/components/PageHeader';
import { Mail } from 'lucide-react';
import { SeedTemplateButton } from '@/components/marketing/SeedTemplateButton';
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { EmailTemplate } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function TemplatesPage() {
  const { firestore } = useFirebase();

  const templatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'emailTemplates'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: templates, isLoading } = useCollection<EmailTemplate>(templatesQuery);

  if (isLoading) {
    return (
      <div className="container py-10 space-y-8">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container py-10 space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="Plantillas de Correo"
          description="Personalice las comunicaciones visuales de su motel"
          icon={<Mail className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />}
        />
        <SeedTemplateButton />
      </div>
      
      <TemplateList templates={templates || []} />
    </div>
  );
}

