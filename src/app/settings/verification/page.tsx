
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getSystemSettings, updateSystemSettings } from '@/lib/actions/system.actions';
import { ShieldCheck, Loader2, Globe } from 'lucide-react';

export default function VerificationSettingsPage() {
  const [domain, setDomain] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    async function loadSettings() {
      const settings = await getSystemSettings();
      setDomain(settings.verificationApiDomain);
      setIsLoading(false);
    }
    loadSettings();
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateSystemSettings({ verificationApiDomain: domain.trim() });
      if (result.success) {
        toast({
          title: 'Ajustes actualizados',
          description: 'El dominio de verificación de Cédula ha sido guardado.',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-6 space-y-6">
      <div className="flex items-center gap-2 text-2xl font-bold">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1>Configuración de Verificación</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" /> Dominio de la API
          </CardTitle>
          <CardDescription>
            Configure el dominio del endpoint para la verificación de Cédulas del Registro Civil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain">Dominio del API (sin https:// ni path)</Label>
            <Input
              id="domain"
              placeholder="api-xxxxx-xx.a.run.app"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Dominio actual: <code className="bg-muted px-1 rounded">{domain || 'api-krdy3op4ma-uc.a.run.app'}</code>
            </p>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button onClick={handleSave} disabled={isPending || !domain.trim()}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar Cambios
          </Button>
        </CardFooter>
      </Card>

      <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
        <CardHeader>
          <CardTitle className="text-amber-800 dark:text-amber-200 text-sm font-bold flex items-center gap-2">
            ¡Importante!
          </CardTitle>
          <CardDescription className="text-amber-700/80 dark:text-amber-300/80 text-xs">
            Asegúrese de que el dominio ingresado sea correcto. Un dominio incorrecto deshabilitará la funcionalidad de verificación automática en el formulario de clientes.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
