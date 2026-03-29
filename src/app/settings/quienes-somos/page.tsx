import { FileText } from 'lucide-react';
import AboutPageForm from '@/components/settings/quienes-somos/AboutPageForm';

export default function AboutPageSettingsPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Quiénes Somos
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Gestione el contenido de texto enriquecido que se muestra en la página pública de Quiénes Somos.
        </p>
      </div>
      
      <AboutPageForm />
    </div>
  );
}
