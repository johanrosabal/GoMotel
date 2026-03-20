import { Layout } from 'lucide-react';
import LandingPageForm from '@/components/settings/landing-page/LandingPageForm';

export default function LandingPageSettingsPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Layout className="h-8 w-8" />
          Administración de Contenido
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Gestione los textos, imágenes e información que se muestra en la página principal (Landing Page).
        </p>
      </div>
      
      <LandingPageForm />
    </div>
  );
}
