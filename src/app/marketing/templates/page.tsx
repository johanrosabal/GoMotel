import { getEmailTemplates } from '@/lib/actions/email.actions';
import { TemplateList } from '@/components/marketing/TemplateList';
import { PageHeader } from '@/components/PageHeader';
import { Mail } from 'lucide-react';
import { SeedTemplateButton } from '@/components/marketing/SeedTemplateButton';

export default async function TemplatesPage() {
  const templates = await getEmailTemplates();

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
      
      <TemplateList templates={templates} />
    </div>
  );
}

