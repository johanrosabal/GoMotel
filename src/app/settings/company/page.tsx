import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building } from 'lucide-react';
import CompanyInfoForm from '@/components/settings/company/CompanyInfoForm';

export default function CompanyInfoPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Building className="h-8 w-8" />
          Información Comercial
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Configuración de datos legales, fiscales y presencia digital oficial de la organización.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Identidad Corporativa</CardTitle>
          <CardDescription>
            Administre los datos básicos de su empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyInfoForm />
        </CardContent>
      </Card>
    </div>
  );
}
