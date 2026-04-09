
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getSystemSettings, updateSystemSettings } from '@/lib/actions/system.actions';
import { testSmtpConnection } from '@/lib/actions/email-sender.actions';
import { ShieldCheck, Loader2, Globe, Settings as SettingsIcon, Monitor, Mail, Key, Server, AtSign, Eye, EyeOff, Send } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export default function SystemSettingsPage() {
  const [domain, setDomain] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // SMTP States
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    async function loadSettings() {
      const settings = await getSystemSettings();
      setDomain(settings.verificationApiDomain);
      setSupportEmail(settings.supportEmail || '');
      setSupportPhone(settings.supportPhone || '');
      setIsDarkMode(!!settings.publicMenuDarkMode);

      setSmtpHost(settings.smtpHost || 'smtp.gmail.com');
      setSmtpPort(settings.smtpPort || 465);
      setSmtpUser(settings.smtpUser || '');
      setSmtpPass(settings.smtpPass || '');
      setSmtpFrom(settings.smtpFrom || '');

      setIsLoading(false);
    }
    loadSettings();
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateSystemSettings({
        verificationApiDomain: domain.trim(),
        supportEmail: supportEmail.trim(),
        supportPhone: supportPhone.trim(),
        publicMenuDarkMode: isDarkMode,
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort),
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim(),
        smtpFrom: smtpFrom.trim(),
      });
      if (result.success) {
        toast({
          title: 'Ajustes actualizados',
          description: 'La configuración del sistema ha sido guardada.',
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

  const handleTestSmtp = async () => {
    if (!smtpUser.trim() || !smtpPass.trim()) {
      toast({
        title: 'Faltan datos',
        description: 'Ingrese el usuario y contraseña para realizar la prueba.',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    try {
      const result = await testSmtpConnection({
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        smtpFrom,
      });

      if (result.success) {
        toast({
          title: 'Prueba Exitosa',
          description: result.message,
        });
      } else {
        toast({
          title: 'Prueba Fallida',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error de Conexión',
        description: 'No se pudo contactar con el servidor SMTP.',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
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
        <SettingsIcon className="h-6 w-6 text-primary" />
        <h1>Configuración del Sistema</h1>
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
              onChange={(e) => setDomain(e.target.value)} data-testid="system-api-domain-input"
            />
            <p className="text-xs text-muted-foreground">
              Dominio actual: <code className="bg-muted px-1 rounded">{domain || 'api-krdy3op4ma-uc.a.run.app'}</code>
            </p>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button onClick={handleSave} disabled={isPending || !domain.trim()} data-testid="system-save-button">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar Cambios
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Contacto de Soporte Técnico
          </CardTitle>
          <CardDescription>
            Defina el correo y número telefónico que se mostrará en el Centro de Ayuda del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Correo de Soporte</Label>
              <Input
                id="supportEmail"
                type="email"
                placeholder="soporte@tuempresa.com"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)} data-testid="system-support-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportPhone">Teléfono / WhatsApp</Label>
              <Input
                id="supportPhone"
                placeholder="+506 8888-8888"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)} data-testid="system-support-phone-input"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button onClick={handleSave} disabled={isPending} data-testid="system-save-button">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" /> Pantalla Pública (Menú TV)
          </CardTitle>
          <CardDescription>
            Ajuste las preferencias visuales de la pantalla del menú público para clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-0.5">
              <Label htmlFor="dark-mode" className="text-base">Modo Oscuro</Label>
              <p className="text-sm text-muted-foreground">
                Activa el modo oscuro en la vista de la pantalla pública (/public/menu).
              </p>
            </div>
            <Switch
              id="dark-mode"
              checked={isDarkMode}
              onCheckedChange={setIsDarkMode} data-testid="system-theme-switch"
            />
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button onClick={handleSave} disabled={isPending} data-testid="system-save-button">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar Cambios
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-primary/5">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Mensajería y Notificaciones (SMTP)
          </CardTitle>
          <CardDescription>
            Configure el servidor de correo saliente para el envío de facturas y notificaciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpFrom" className="flex items-center gap-2">
                <AtSign className="h-3.5 w-3.5" /> Email Remitente (Nombre)
              </Label>
              <Input
                id="smtpFrom"
                placeholder="Hotel Du Manolo <info@hotel.com>"
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)} data-testid="system-smtp-from-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpUser" className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" /> Usuario SMTP (Email)
              </Label>
              <Input
                id="smtpUser"
                type="email"
                placeholder="ejemplo@gmail.com"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)} data-testid="system-smtp-user-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="smtpHost" className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5" /> Servidor SMTP
              </Label>
              <Input
                id="smtpHost"
                placeholder="smtp.gmail.com"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)} data-testid="system-smtp-host-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">Puerto</Label>
              <Input
                id="smtpPort"
                type="number"
                placeholder="465"
                value={smtpPort}
                onChange={(e) => setSmtpPort(parseInt(e.target.value))} data-testid="system-smtp-port-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtpPass" className="flex items-center gap-2">
              <Key className="h-3.5 w-3.5" /> Contraseña / App Password
            </Label>
            <div className="relative">
              <Input
                id="smtpPass"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••••••"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                className="pr-10" data-testid="system-smtp-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors" data-testid="system-smtp-password-toggle-button"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground bg-muted p-2 rounded">
              Tip: Para Gmail, usa una <span className="font-bold text-primary">Contraseña de Aplicación</span> de 16 caracteres.
            </p>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4 flex justify-between items-center bg-muted/20">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            {smtpUser ? `Conectado a ${smtpUser.split('@')[1]}` : 'Sin configurar'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTestSmtp}
              disabled={isPending || isTesting}
              className="border-primary/50 text-primary hover:bg-primary hover:text-white transition-all duration-300"
              data-testid="system-smtp-test-button"
            >
              {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar Prueba
            </Button>
            <Button onClick={handleSave} disabled={isPending || isTesting} data-testid="system-save-button">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar Cambios
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
