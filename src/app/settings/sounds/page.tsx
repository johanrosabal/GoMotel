import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SoundSettings from '@/components/settings/sounds/SoundSettings';
import { Bell } from 'lucide-react';

export default function SoundsPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Configuración de Sonido de Alarma
          </CardTitle>
          <CardDescription>
            Elija el sonido que se reproducirá para las alertas importantes, como las estancias vencidas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SoundSettings />
        </CardContent>
      </Card>
    </div>
  );
}
