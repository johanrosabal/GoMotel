'use client';

import { useState, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ShieldCheck, Activity, Database, CheckCircle2, XCircle, AlertCircle, PlayCircle, Loader2, Globe, Mail, ChefHat, GlassWater, Sparkles, UserCog, Receipt, LayoutDashboard } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { ref, listAll } from 'firebase/storage';
import { pingFirebase, pingSmtp } from '@/lib/actions/health.actions';
import { SystemPOM } from '@/lib/tests/pages/SystemPOM';
import { KitchenPOM } from '@/lib/tests/pages/KitchenPOM';
import { BarPOM } from '@/lib/tests/pages/BarPOM';
import { ClientPOM } from '@/lib/tests/pages/ClientPOM';
import { InvoicePOM } from '@/lib/tests/pages/InvoicePOM';
import { CleaningPOM } from '@/lib/tests/pages/CleaningPOM';
import { TestResult, TestStatus, PageObject } from '@/lib/tests/types';

// Registry of modules to monitor separately
const MODULE_POMS: PageObject[] = [
  KitchenPOM,
  BarPOM,
  CleaningPOM,
  ClientPOM,
  InvoicePOM
];

const ICONS: Record<string, any> = {
  ChefHat: <ChefHat className="h-5 w-5" />,
  GlassWater: <GlassWater className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
  UserCog: <UserCog className="h-5 w-5" />,
  Receipt: <Receipt className="h-5 w-5" />
};

export default function StabilityDashboardPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const { firestore, storage } = useFirebase();

  const runTests = () => {
    setResults([]);
    setProgress(0);
    
    startTransition(async () => {
      const allResults: TestResult[] = [];
      
      // 1. Connectivity Tests (25%)
      const fbStart = Date.now();
      try {
        if (!firestore) throw new Error("Firestore no inicializado");
        const q = query(collection(firestore, 'rooms'), limit(1));
        await getDocs(q);
        allResults.push({
          id: 'conn-fb-client',
          name: 'Firestore (Query)',
          description: 'Latencia de lectura desde el navegador.',
          status: 'passed',
          message: 'Base de datos respondiendo correctamente.',
          category: 'connectivity',
          duration: Date.now() - fbStart
        });
      } catch (error: any) {
        allResults.push({ id: 'conn-fb-client', name: 'Firestore', description: 'Conexión fallida.', status: 'failed', message: error.message, category: 'connectivity' });
      }
      setProgress(15);

      const stStart = Date.now();
      try {
        if (!storage) throw new Error("Storage no inicializado");
        await listAll(ref(storage, '/'));
        allResults.push({
          id: 'conn-st-client',
          name: 'Storage (Cloud)',
          description: 'Accesibilidad de archivos binarios.',
          status: 'passed',
          message: 'Cloud Storage accesible para el cliente.',
          category: 'connectivity',
          duration: Date.now() - stStart
        });
      } catch (error: any) {
        allResults.push({ id: 'conn-st-client', name: 'Storage', description: 'Error de acceso.', status: 'warning', message: 'Verifique reglas de Storage.', category: 'connectivity' });
      }
      setProgress(30);

      const smtpRes = await pingSmtp();
      allResults.push(smtpRes);
      setProgress(45);

      // 2. Module Matrix Validation (45% - 90%)
      const totalModules = MODULE_POMS.length;
      for (let i = 0; i < totalModules; i++) {
        const pom = MODULE_POMS[i];
        const res = await pom.validate();
        allResults.push(...res);
        setProgress(45 + Math.floor(((i + 1) / totalModules) * 45));
      }

      // 3. System Page Validation (Final)
      const systemRes = await SystemPOM.validate();
      allResults.push(...systemRes);
      
      setResults(allResults);
      setProgress(100);
    });
  };

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'passed': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'failed': return <XCircle className="h-5 w-5 text-rose-500" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case 'not-on-page': return <LayoutDashboard className="h-5 w-5 text-muted-foreground/50" />;
      default: return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: TestStatus) => {
    switch (status) {
      case 'passed': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] uppercase font-black tracking-widest">ESTABLE</Badge>;
      case 'failed': return <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[10px] uppercase font-black tracking-widest">ERROR</Badge>;
      case 'warning': return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] uppercase font-black tracking-widest">ATENCIÓN</Badge>;
      case 'not-on-page': return <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/20 text-[10px] uppercase font-black tracking-widest">OFF-PAGE</Badge>;
      default: return <Badge variant="secondary">待機</Badge>;
    }
  };

  // Helper to find a module status in the results array
  const getModuleStatus = (moduleName: string) => {
    const res = results.find(r => r.name.includes(moduleName));
    return res?.status || 'idle';
  };

  return (
    <div className="container max-w-6xl py-10 space-y-12 pb-48">
        {/* Cinematic Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b pb-8">
            <div className="space-y-3">
                <div className="flex items-center gap-3 text-4xl md:text-5xl font-black tracking-tighter uppercase italic">
                    <ShieldCheck className="h-10 w-10 text-primary" />
                    <h1>Matriz de <span className="text-primary tracking-widest">Integridad</span></h1>
                </div>
                <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-[10px] italic">
                    Monitor de estabilidad en tiempo real para el ecosistema Go Motel v2.0
                </p>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Último Análisis</p>
                    <p className="text-xs font-black tabular-nums">{new Date().toLocaleTimeString()}</p>
                </div>
                <Button 
                    size="lg" 
                    className={cn(
                        "h-16 px-10 rounded-2xl border-b-4 border-primary-foreground/20 shadow-xl transition-all active:translate-y-1 active:border-b-0 font-black tracking-widest uppercase italic",
                        isPending && "animate-pulse"
                    )}
                    onClick={runTests}
                    disabled={isPending}
                    data-testid="stability-action-button"
                >
                    {isPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <PlayCircle className="mr-2 h-6 w-6" />}
                    {isPending ? 'Ejecutando...' : 'Iniciar Escaneo'}
                </Button>
            </div>
        </div>

        {isPending && (
            <div className="space-y-3 animate-in fade-in duration-700">
                <div className="flex justify-between items-end">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary italic">Hackeando el sistema...</p>
                        <p className="text-2xl font-black tabular-nums tracking-tighter italic">{progress}%</p>
                    </div>
                    <Activity className="h-6 w-6 text-primary animate-pulse" />
                </div>
                <Progress value={progress} className="h-3 rounded-none bg-primary/10 border border-primary/20" />
            </div>
        )}

        {/* Health Matrix Grid */}
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                 <div className="h-[2px] bg-primary/30 flex-1" />
                 <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-primary italic">Niveles de Servicio</h2>
                 <div className="h-[2px] bg-primary/30 flex-1" />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Core Services first */}
                <ModuleCard name="Firestore" icon={<Globe className="h-5 w-5" />} status={results.find(r => r.id === 'conn-fb-client')?.status || 'idle'} />
                <ModuleCard name="Storage" icon={<Database className="h-5 w-5" />} status={results.find(r => r.id === 'conn-st-client')?.status || 'idle'} />
                <ModuleCard name="Email" icon={<Mail className="h-5 w-5" />} status={results.find(r => r.id === 'conn-smtp-01')?.status || 'idle'} />
                
                {/* Dynamically grouped modules */}
                {MODULE_POMS.map(pom => (
                    <ModuleCard 
                      key={pom.name} 
                      name={pom.name} 
                      icon={ICONS[pom.iconName]} 
                      status={results.find(r => r.name === pom.name)?.status || (results.some(r => r.name.includes(pom.name)) ? results.find(r => r.name.includes(pom.name))?.status : 'idle') as TestStatus} 
                    />
                ))}
            </div>
        </div>

        {/* Detailed Logs */}
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest italic flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Log de Transacciones
                </h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {results.length === 0 && !isPending && (
                    <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl bg-muted/5 opacity-50">
                        <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Sistema a la espera de instrucciones.</p>
                    </div>
                )}
                
                {results.map((test) => (
                    <div 
                        key={test.id} 
                        className={cn(
                            "group p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-6",
                            test.status === 'passed' ? "bg-emerald-500/[0.02] border-emerald-500/10 hover:border-emerald-500/30" :
                            test.status === 'failed' ? "bg-rose-500/[0.02] border-rose-500/10 hover:border-rose-500/30" :
                            test.status === 'not-on-page' ? "bg-muted/5 border-muted/20 grayscale" :
                            "bg-amber-500/[0.02] border-amber-500/10 hover:border-amber-500/30"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "p-3 rounded-xl border-2 transition-transform group-hover:scale-110",
                                test.status === 'passed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                test.status === 'failed' ? "bg-rose-500/10 border-rose-500/20 text-rose-500" :
                                "bg-amber-500/10 border-amber-500/20 text-amber-500"
                            )}>
                                {getStatusIcon(test.status)}
                            </div>
                            <div className="space-y-0.5">
                                <h4 className="font-black text-sm uppercase tracking-tighter">{test.name}</h4>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{test.description}</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1 text-right">
                            {getStatusBadge(test.status)}
                            <span className="text-[9px] font-black text-muted-foreground tabular-nums uppercase">{test.duration ? `${test.duration}ms` : '--'}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
}

function ModuleCard({ name, icon, status }: { name: string, icon: any, status: TestStatus }) {
    return (
        <Card className={cn(
            "relative overflow-hidden group transition-all duration-500 border-2",
            status === 'passed' ? "border-emerald-500/30 bg-emerald-500/[0.05] shadow-emerald-500/10 shadow-lg" : 
            status === 'failed' ? "border-rose-500/30 bg-rose-500/[0.05] shadow-rose-500/10 shadow-lg" :
            status === 'warning' ? "border-amber-500/30 bg-amber-500/[0.05] shadow-amber-500/10 shadow-lg" :
            status === 'not-on-page' ? "border-muted border-dashed bg-muted/10 opacity-90" :
            "border-border bg-background/80 opacity-90"
        )}>
            <CardContent className="p-4 py-6 flex flex-col items-center justify-center text-center gap-3">
                <div className={cn(
                    "p-3 rounded-2xl border-2 transition-all duration-500 group-hover:rotate-[360deg]",
                    status === 'passed' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-500" :
                    status === 'failed' ? "bg-rose-500/20 border-rose-500/30 text-rose-500" :
                    status === 'not-on-page' ? "bg-muted border-muted-foreground/20 text-muted-foreground/60" :
                    "bg-muted border-border text-muted-foreground"
                )}>
                    {icon}
                </div>
                <div className="space-y-1">
                    <p className="font-black text-[11px] uppercase tracking-widest italic text-foreground">{name}</p>
                    <p className={cn(
                        "text-[10px] font-black uppercase font-mono tracking-tighter",
                        status === 'passed' ? "text-emerald-500" :
                        status === 'failed' ? "text-rose-500" :
                        status === 'not-on-page' ? "text-muted-foreground" :
                        "text-muted-foreground/70"
                    )}>
                        {status === 'not-on-page' ? 'OFF-LOG' : status === 'passed' ? 'SANO' : status === 'failed' ? 'ERROR' : 'PENDIENTE'}
                    </p>
                </div>
                
                {/* Visual indicator bar at bottom */}
                <div className={cn(
                    "absolute bottom-0 left-0 right-0 h-1 transition-all duration-1000",
                    status === 'passed' ? "bg-emerald-500 w-full" : 
                    status === 'failed' ? "bg-rose-500 w-full" :
                    "bg-transparent w-0"
                )} />
            </CardContent>
        </Card>
    );
}
