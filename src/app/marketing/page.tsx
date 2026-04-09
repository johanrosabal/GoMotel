import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Megaphone, ReceiptText, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const modules = [
  {
    title: 'Plantillas de Correo',
    description: 'Cree y edite los diseños para sus comunicaciones por email.',
    icon: Mail,
    href: '/marketing/templates',
    color: 'text-primary',
    bgColor: 'bg-primary/10'
  },
  {
    title: 'Campañas Masivas',
    description: 'Envíe promociones y eventos a toda su base de datos.',
    icon: Megaphone,
    href: '/marketing/campaigns',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    disabled: true
  },
  {
    title: 'Facturación por Email',
    description: 'Automatice el envío de facturas PDF a sus clientes.',
    icon: ReceiptText,
    href: '/marketing/invoices',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    disabled: true
  },
  {
    title: 'Base de Clientes',
    description: 'Gestione su lista de contactos y preferencias de envío.',
    icon: Users,
    href: '/clients',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10'
  }
];

export default function MarketingPage() {
  return (
    <div className="container py-10 space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <PageHeader 
        title="Centro de Marketing"
        description="Gestione la comunicación y fidelización de sus huéspedes"
        icon={<Megaphone className="h-8 w-8 text-primary" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((module) => (
          <Link 
            key={module.title} 
            href={module.disabled ? '#' : module.href}
            className={module.disabled ? 'cursor-not-allowed opacity-60' : 'group'} data-testid="marketing-action-link"
          >
            <Card className="h-full border-primary/10 hover:border-primary/30 transition-all duration-300 shadow-xl shadow-primary/5 hover:shadow-primary/10">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className={`${module.bgColor} p-3 rounded-2xl`}>
                  <module.icon className={`h-6 w-6 ${module.color}`} />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl font-bold">{module.title}</CardTitle>
                  <CardDescription className="text-sm mt-1">{module.description}</CardDescription>
                </div>
                {!module.disabled && (
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-1" />
                )}
              </CardHeader>
              {module.disabled && (
                <CardContent>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-muted px-2 py-1 rounded text-muted-foreground border">
                    Próximamente
                  </span>
                </CardContent>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
