'use client';

import { getEmailTemplate } from '@/lib/actions/email.actions';
import { TemplateForm } from '@/components/marketing/TemplateForm';
import { notFound } from 'next/navigation';
import { useState, useEffect, use } from 'react';
import type { EmailTemplate } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

interface EditTemplatePageProps {
  params: Promise<{ id: string }>;
}

export default function EditTemplatePage({ params }: EditTemplatePageProps) {
  const { id } = use(params);
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmailTemplate(id).then(data => {
      setTemplate(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="container py-10 space-y-8">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!template) {
    notFound();
  }

  return (
    <div className="container py-10 space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700 text-white">
      <TemplateForm initialData={template} templateId={id} />
    </div>
  );
}
