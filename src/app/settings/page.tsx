import Link from 'next/link';
import { BedDouble, Bell, Percent, BookCopy, Building, Layout, Settings as SettingsIcon, ChevronRight } from 'lucide-react';

const SETTINGS_MODULES = [
    {
        title: "Información Comercial",
        description: "Gestione los datos legales y fiscales de su empresa.",
        icon: Building,
        href: "/settings/company"
    },
    {
        title: "Tipos de Habitación",
        description: "Gestionar los tipos de habitación disponibles.",
        icon: BedDouble,
        href: "/settings/room-types"
    },
    {
        title: "Sonido de Alarma",
        description: "Seleccione el sonido para las notificaciones de estancias vencidas.",
        icon: Bell,
        href: "/settings/sounds"
    },
    {
        title: "Gestión de Impuestos",
        description: "Defina los impuestos aplicables a productos y servicios.",
        icon: Percent,
        href: "/settings/taxes"
    },
    {
        title: "Catálogo de Productos",
        description: "Gestiona categorías, sub-categorías y productos.",
        icon: BookCopy,
        href: "/catalog"
    },
    {
        title: "Administración de Inicio",
        description: "Gestione los textos e información de la página pública.",
        icon: Layout,
        href: "/settings/landing-page"
    },
    {
        title: "Centro de Notificaciones",
        description: "Gestione avisos públicos para clientes y mensajes internos para el personal.",
        icon: Bell,
        href: "/settings/notifications"
    },
    {
        title: "Sistema General",
        description: "Configure opciones del sistema y del Menú de TV.",
        icon: SettingsIcon,
        href: "/settings/system"
    }
];

export default function SettingsPage() {
  return (
    <div className="container max-w-7xl py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className='space-y-2 mb-10'>
            <h1 className="text-3xl font-black tracking-tight text-neutral-900 dark:text-white flex items-center gap-3">
                <SettingsIcon className="h-8 w-8 text-primary" />
                Ajustes del Sistema
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-2xl">
                Panel de control avanzado. Administre las configuraciones de su plataforma seleccionando el módulo que desea gestionar.
            </p>
        </div>
        
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {SETTINGS_MODULES.map((module) => (
                <Link 
                    key={module.href} 
                    href={module.href}
                    className="group relative flex flex-col p-6 rounded-2xl bg-white dark:bg-neutral-900/40 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800/80 hover:border-primary/50 dark:hover:border-primary/50 transition-all duration-500 hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-primary/20 dark:shadow-primary/20 dark:hover:-translate-y-1 hover:-translate-y-1 overflow-hidden shadow-sm"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    
                    <div className="relative flex items-start justify-between mb-5">
                        <div className="p-3.5 bg-neutral-100 dark:bg-neutral-950/50 rounded-xl group-hover:bg-primary/10 dark:group-hover:bg-primary/20 transition-colors duration-500 ring-1 ring-black/5 dark:ring-white/5 shadow-inner">
                            <module.icon className="h-6 w-6 text-neutral-600 dark:text-neutral-400 group-hover:text-primary dark:group-hover:text-primary transition-colors duration-500" />
                        </div>
                        <div className="bg-neutral-100 dark:bg-neutral-900/80 p-1.5 rounded-full ring-1 ring-black/5 dark:ring-white/5 group-hover:ring-primary/50 group-hover:bg-primary/10 transition-all duration-300">
                            <ChevronRight className="h-4 w-4 text-neutral-500 group-hover:text-primary group-hover:translate-x-0.5 transition-transform duration-300" />
                        </div>
                    </div>
                    
                    <div className="relative flex-1 flex flex-col justify-end">
                        <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-200 group-hover:text-primary dark:group-hover:text-white mb-2 tracking-tight transition-colors duration-300">{module.title}</h3>
                        <p className="text-[13px] text-neutral-500 dark:text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-400 leading-relaxed transition-colors duration-300">
                            {module.description}
                        </p>
                    </div>
                </Link>
            ))}
        </div>
    </div>
  );
}
