'use client';

import { useState, useTransition } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EmailTemplate } from '@/types';
import { saveEmailTemplate } from '@/lib/actions/email.actions';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, Save, ArrowLeft, Tag, Info, Layout, Eye, Edit3, Loader2, Code2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TemplatePreview } from './TemplatePreview';
import { Textarea } from '@/components/ui/textarea';

const templateSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  subject: z.string().min(5, 'El asunto es requerido.'),
  type: z.enum(['transactional', 'marketing', 'invoice']),
  bodyHtml: z.string().min(10, 'El contenido del correo es requerido.'),
  variables: z.array(z.string()).default([]),
});

type FormData = z.infer<typeof templateSchema>;

interface TemplateFormProps {
  initialData?: EmailTemplate;
  templateId?: string;
}

const COMMON_VARIABLES = [
  'nombre_cliente',
  'email_cliente',
  'monto_total',
  'numero_reserva',
  'fecha_entrada',
  'fecha_salida',
  'tipo_habitacion',
  'nombre_habitacion',
  'nombre_empresa',
  'direccion_empresa',
  'email_empresa',
  'telefono_empresa',
  'detalle_factura_html',
];

export function TemplateForm({ initialData, templateId }: TemplateFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const [activeVariables, setActiveVariables] = useState<string[]>(initialData?.variables || []);
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual');

  const form = useForm<FormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: initialData?.name || '',
      subject: initialData?.subject || '',
      type: initialData?.type || 'marketing',
      bodyHtml: initialData?.bodyHtml || '',
      variables: initialData?.variables || [],
    },
  });

  // Watch form values for real-time preview
  const watchedValues = form.watch();

  const onSubmit = async (values: FormData) => {
    const id = templateId || `template_${Date.now()}`;
    startTransition(async () => {
      try {
        await saveEmailTemplate(id, {
          ...values,
          variables: activeVariables,
        });
        toast({ title: '¡Éxito!', description: 'Plantilla guardada correctamente.' });
        router.push('/marketing/templates');
        router.refresh();
      } catch (error) {
        toast({ title: 'Error', description: 'No se pudo guardar la plantilla.', variant: 'destructive' });
      }
    });
  };

  const toggleVariable = (variable: string) => {
    if (activeVariables.includes(variable)) {
      setActiveVariables(prev => prev.filter(v => v !== variable));
    } else {
      setActiveVariables(prev => [...prev, variable]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6 mb-8 border-primary/10">
        <div className="flex items-center gap-4">
          <Link href="/marketing/templates" data-testid="templateform-marketing-templates-link">
            <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-primary/30 hover:bg-primary hover:text-white transition-all shadow-sm" data-testid="templateform-back-button">
              <ArrowLeft className="h-5 w-5 text-primary active:scale-95 transition-transform" />
            </Button>
          </Link>
          <div className="space-y-1">
            <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">
              {templateId ? 'Editar Plantilla' : 'Nueva Plantilla'}
            </h1>
            <p className="text-xs font-medium text-muted-foreground italic flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary" />
              {templateId ? 'Modificando diseño existente' : 'Creando nuevo formato de comunicación'}
            </p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" data-testid="templateform-main-form">
          <Tabs defaultValue="editor" className="w-full">
            <div className="flex justify-center mb-6">
              <TabsList className="grid w-[400px] grid-cols-2 h-12 bg-muted/50 p-1 border border-primary/10">
                <TabsTrigger value="editor" className="gap-2 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground transition-all">
                  <Edit3 className="h-3.5 w-3.5" /> Editor
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-2 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground transition-all">
                  <Eye className="h-3.5 w-3.5" /> Vista Previa
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="editor" className="mt-0 focus-visible:ring-0 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <Card className="border-primary/10 shadow-xl shadow-primary/5">
                    <CardHeader className="bg-primary/5 border-b border-primary/10 flex flex-row items-center justify-between py-4">
                      <CardTitle className="flex items-center gap-2 text-primary">
                        <Mail className="h-5 w-5" /> Detalles del Correo
                      </CardTitle>

                      <div className="flex items-center gap-1 bg-background/50 p-1 rounded-lg border">
                        <Button
                          type="button"
                          variant={editorMode === 'visual' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setEditorMode('visual')}
                          className="h-8 gap-2 text-[10px] font-black uppercase tracking-widest px-3" data-testid="templateform-action-visual-button"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Visual
                        </Button>
                        <Button
                          type="button"
                          variant={editorMode === 'html' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setEditorMode('html')}
                          className="h-8 gap-2 text-[10px] font-black uppercase tracking-widest px-3" data-testid="templateform-action-html-button"
                        >
                          <Code2 className="h-3.5 w-3.5" /> HTML
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <FormField
                        control={form.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-foreground/80">Asunto del Correo</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ej: Confirmación de su Reserva en {{nombre_empresa}}" className="h-12 bg-muted/30 focus:bg-background transition-all text-foreground" data-testid="templateform-subject-input" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="bodyHtml"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between mb-2">
                              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-foreground/80">Cuerpo del Diseño</FormLabel>
                              {editorMode === 'html' && (
                                <Badge variant="outline" className="text-[9px] font-mono border-primary/30 text-primary">Edición en Código Libre</Badge>
                              )}
                            </div>
                            <FormControl>
                              {editorMode === 'visual' ? (
                                <RichTextEditor content={field.value} onChange={field.onChange} />
                              ) : (
                                <Textarea
                                  {...field}
                                  placeholder="Escriba su código HTML aquí..."
                                  className="min-h-[400px] font-mono text-sm leading-relaxed bg-zinc-950 text-emerald-400 border-primary/20 focus:border-primary/50 transition-all p-6 selection:bg-primary/30 shadow-inner" data-testid="templateform-body-textarea"
                                />
                              )}
                            </FormControl>
                            <FormMessage />
                            <FormDescription className="text-[10px] italic text-muted-foreground">
                              {editorMode === 'visual'
                                ? "Use dobles llaves para variables: Hola {{nombre_cliente}}"
                                : "Asegúrese de usar estilos en línea (inline styles) para mejor compatibilidad."}
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-8">
                  <Card className="border-primary/10 shadow-xl overflow-hidden">
                    <CardHeader className="bg-secondary/50 border-b">
                      <CardTitle className="text-sm flex items-center gap-2 uppercase tracking-widest text-foreground">
                        <Layout className="h-4 w-4 text-primary" /> Configuración
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-foreground/80">Nombre Interno</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ej: Confirmación Reserva" className="h-10 text-foreground" data-testid="templateform-name-input" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-foreground/80">Categoría</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-10 text-foreground" data-testid="templateform-type-select">
                                  <SelectValue placeholder="Seleccione tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="marketing">Campaña / Marketing</SelectItem>
                                <SelectItem value="transactional">Automático / Transaccional</SelectItem>
                                <SelectItem value="invoice">Facturación</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-primary/10 bg-muted/20">
                    <CardHeader className="py-4">
                      <CardTitle className="text-xs flex items-center gap-2 uppercase tracking-widest text-primary">
                        <Tag className="h-4 w-4" /> Variables Dinámicas
                      </CardTitle>
                      <CardDescription className="text-[10px] text-muted-foreground">
                        Presione para activar variables en el sistema.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {COMMON_VARIABLES.map(variable => (
                          <Badge
                            key={variable}
                            variant={activeVariables.includes(variable) ? "default" : "outline"}
                            className={cn(
                              "cursor-pointer transition-all hover:scale-105 py-1 px-2 text-[10px] font-mono",
                              !activeVariables.includes(variable) && "bg-background text-foreground hover:border-primary/40",
                              activeVariables.includes(variable) && "shadow-lg shadow-primary/20"
                            )}
                            onClick={() => toggleVariable(variable)}
                          >
                            {`{{${variable}}}`}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Button type="submit" size="lg" className="w-full h-14 rounded-xl gap-2 font-black uppercase tracking-widest shadow-xl shadow-primary/20" disabled={isPending} data-testid="templateform-submit-button">
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    {templateId ? 'Actualizar Plantilla' : 'Guardar Plantilla'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-0 focus-visible:ring-0 animate-in fade-in slide-in-from-right-4 duration-300">
              <TemplatePreview
                bodyHtml={watchedValues.bodyHtml}
                subject={watchedValues.subject}
                variables={activeVariables}
              />
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </div>
  );
}
