import { getEmailTemplate } from '@/lib/actions/email.actions';
import { TemplateForm } from '@/components/marketing/TemplateForm';
import { notFound } from 'next/navigation';

interface EditTemplatePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
  const { id } = await params;
  const template = await getEmailTemplate(id);

  if (!template) {
    notFound();
  }

  return (
    <div className="container py-10 space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700 text-white">
      <TemplateForm initialData={template} templateId={id} />
    </div>
  );
}
