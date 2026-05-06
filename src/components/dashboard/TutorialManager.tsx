'use client';

import { useState, useTransition } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Plus,
    Pencil,
    Trash2,
    Video,
    ExternalLink,
    Save,
    Loader2,
    ShieldAlert,
    Play,
    Info as InfoIcon,
    Download,
    Upload
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveTutorial, deleteTutorial, importTutorials } from '@/lib/actions/tutorial.actions';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { VideoPlayer } from '@/components/dashboard/VideoPlayer';
import { Badge } from '@/components/ui/badge';
import type { Tutorial } from '@/types';
import { useUserProfile } from '@/hooks/use-user-profile';
import { MediaUpload } from '@/components/ui/media-upload';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TutorialManagerProps {
    initialTutorials: Tutorial[];
}

export default function TutorialManager({ initialTutorials }: TutorialManagerProps) {
    const { userProfile, isLoading } = useUserProfile();
    const [tutorials, setTutorials] = useState<Tutorial[]>(initialTutorials);
    const [isPending, startTransition] = useTransition();
    const [isOpen, setIsOpen] = useState(false);
    const [previewTutorial, setPreviewTutorial] = useState<Tutorial | null>(null);
    const [editingTutorial, setEditingTutorial] = useState<Partial<Tutorial> | null>(null);
    const { toast } = useToast();

    const handleEdit = (tutorial: Tutorial | null) => {
        setEditingTutorial(tutorial || {
            title: '',
            description: '',
            videoUrl: '',
            category: 'Operaciones',
            order: tutorials.length
        });
        setIsOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Está seguro de eliminar este tutorial?')) return;

        const result = await deleteTutorial(id);
        if (result.success) {
            setTutorials(prev => prev.filter(t => t.id !== id));
            toast({ title: 'Eliminado', description: 'El tutorial ha sido eliminado.' });
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTutorial?.title || !editingTutorial?.videoUrl) {
            toast({ title: 'Faltan datos', description: 'Título y Video son requeridos.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            const result = await saveTutorial(editingTutorial);
            if (result.success) {
                toast({ title: '¡Guardado!', description: 'El tutorial se ha actualizado correctamente.' });
                setIsOpen(false);
                window.location.reload();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    const handleExport = () => {
        const dataStr = JSON.stringify(tutorials, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `tutoriales_export_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        toast({ title: 'Exportación Lista', description: 'Se ha descargado el archivo JSON con los tutoriales.' });
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedData = JSON.parse(event.target?.result as string);
                if (!Array.isArray(importedData)) {
                    throw new Error('El archivo no tiene el formato correcto (debe ser un array).');
                }

                startTransition(async () => {
                    const result = await importTutorials(importedData);
                    if (result.success) {
                        toast({ title: 'Importación Exitosa', description: `Se han procesado ${result.count} tutoriales.` });
                        window.location.reload();
                    } else {
                        toast({ title: 'Error en Importación', description: result.error, variant: 'destructive' });
                    }
                });
            } catch (err: any) {
                toast({ title: 'Error de Lectura', description: err.message, variant: 'destructive' });
            }
        };
        reader.readAsText(file);
    };

    if (isLoading) return <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    if (userProfile?.role !== 'Administrador') {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white/5 rounded-[2.5rem] border border-white/10 text-center space-y-4">
                <div className="h-20 w-20 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20">
                    <ShieldAlert className="h-10 w-10 text-rose-500" />
                </div>
                <h3 className="text-xl font-black uppercase italic text-white">Acceso Restringido</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest max-w-sm">
                    Solo los administradores pueden gestionar el contenido del centro de aprendizaje.
                </p>
                <Button variant="outline" onClick={() => window.location.href = '/dashboard'} className="rounded-2xl uppercase tracking-widest text-[10px] font-bold h-12 px-8" data-testid="tutorialmanager-back-button">
                    Volver al Inicio
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white/5 p-6 rounded-[2rem] border border-white/10 backdrop-blur-xl">
                <div>
                    <h2 className="text-xl font-black uppercase italic tracking-tight text-white flex items-center gap-3">
                        <Video className="h-6 w-6 text-primary" />
                        Gestión de Tutoriales
                    </h2>
                    <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Cree y organice el centro de aprendizaje</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        onClick={handleExport}
                        className="rounded-2xl gap-2 h-12 px-6 font-bold uppercase tracking-widest text-[10px] border-white/10 hover:bg-white/10"
                        data-testid="tutorialmanager-export-button"
                    >
                        <Download className="h-4 w-4" /> Exportar
                    </Button>
                    <div className="relative">
                        <input
                            type="file"
                            id="import-tutorials"
                            className="hidden"
                            accept=".json"
                            onChange={handleImport}
                        />
                        <Button 
                            variant="outline" 
                            onClick={() => document.getElementById('import-tutorials')?.click()}
                            className="rounded-2xl gap-2 h-12 px-6 font-bold uppercase tracking-widest text-[10px] border-white/10 hover:bg-white/10"
                            data-testid="tutorialmanager-import-button"
                        >
                            <Upload className="h-4 w-4" /> Importar
                        </Button>
                    </div>
                    <Button onClick={() => handleEdit(null)} className="rounded-2xl gap-2 h-12 px-6 font-bold uppercase tracking-widest text-[10px]" data-testid="tutorialmanager-new-button">
                        <Plus className="h-4 w-4" /> Nuevo Tutorial
                    </Button>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-xl">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="hover:bg-transparent border-white/5">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 h-14 w-20">Orden</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 h-14">Título</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 h-14">Categoría</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 h-14">Video</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500 h-14 px-8">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tutorials.map((t) => (
                            <TableRow key={t.id} className="hover:bg-white/5 border-white/5 transition-colors group">
                                <TableCell className="font-bold text-slate-400 text-xs">{t.order}</TableCell>
                                <TableCell>
                                    <p className="font-black text-white text-sm uppercase italic tracking-tight">{t.title}</p>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-black uppercase tracking-widest rounded-lg">
                                        {t.category}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-4">
                                        <button 
                                            onClick={() => setPreviewTutorial(t)}
                                            className="relative h-14 w-24 rounded-xl overflow-hidden bg-black border border-white/10 group-hover:border-primary/50 transition-all shadow-2xl group/thumb"
                                        >
                                            <video 
                                                src={t.videoUrl} 
                                                className="h-full w-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                                                preload="metadata"
                                                muted
                                                onMouseOver={e => (e.target as HTMLVideoElement).play()}
                                                onMouseOut={e => {
                                                    const v = e.target as HTMLVideoElement;
                                                    v.pause();
                                                    v.currentTime = 0;
                                                }}
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors">
                                                <div className="h-6 w-6 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover/thumb:scale-110 transition-transform">
                                                    <Play className="h-2 w-2 text-white fill-white" />
                                                </div>
                                            </div>
                                        </button>
                                        <a href={t.videoUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary flex items-center gap-1 transition-colors" data-testid="tutorialmanager-action-link">
                                            <ExternalLink className="h-3 w-3" /> Ver Original
                                        </a>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right px-8 space-x-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(t)} className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all" data-testid="tutorialmanager-edit-button">
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} className="h-9 w-9 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-all" data-testid="tutorialmanager-delete-button">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {tutorials.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-40 text-center">
                                    <p className="text-slate-500 text-xs font-black uppercase tracking-widest opacity-50 italic">No hay tutoriales registrados.</p>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-neutral-950 border-white/10 rounded-[2.5rem]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase italic text-white flex items-center gap-2">
                            {editingTutorial?.id ? 'Editar Tutorial' : 'Nuevo Tutorial'}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                            Defina el contenido y suba el video para este recurso de aprendizaje.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-6 pt-4" data-testid="tutorialmanager-main-form">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Título del Tutorial</Label>
                                <Input
                                    value={editingTutorial?.title || ''}
                                    onChange={e => setEditingTutorial(prev => ({ ...prev, title: e.target.value }))}
                                    className="h-12 bg-white/5 border-white/10 rounded-2xl text-white font-bold"
                                    placeholder="Ej: Cómo realizar un Check-out" data-testid="tutorialmanager-1-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Categoría</Label>
                                <Input
                                    value={editingTutorial?.category || ''}
                                    onChange={e => setEditingTutorial(prev => ({ ...prev, category: e.target.value }))}
                                    className="h-12 bg-white/5 border-white/10 rounded-2xl text-white font-bold"
                                    placeholder="Ej: Operaciones" data-testid="tutorialmanager-2-input"
                                />
                            </div>
                        </div>

                        <div className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Video className="h-4 w-4 text-primary" />
                                <Label className="text-[10px] font-black uppercase tracking-widest text-white italic">Archivo de Video (Subida Directa)</Label>
                            </div>
                            <MediaUpload
                                value={editingTutorial?.videoUrl || ''}
                                onChange={url => setEditingTutorial(prev => ({ ...prev, videoUrl: url }))}
                                type="video"
                                path="tutorials"
                                maxSizeMB={500}
                            />
                            <div className="flex items-start gap-2 px-4 py-3 bg-primary/5 rounded-xl border border-primary/10">
                                <InfoIcon className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                                <p className="text-[9px] text-slate-400 font-medium leading-relaxed italic uppercase">
                                    El video se almacenará de forma segura en los servidores de <span className="text-primary font-black">Go Motel</span>. Use formatos estándar como <span className="text-white">MP4</span>.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Orden de Aparición</Label>
                                <Input
                                    type="number"
                                    value={editingTutorial?.order ?? 0}
                                    onChange={e => setEditingTutorial(prev => ({ ...prev, order: parseInt(e.target.value) }))}
                                    className="h-12 bg-white/5 border-white/10 rounded-2xl text-white font-bold" data-testid="tutorialmanager-3-input"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Instrucciones / Descripción (Texto Enriquecido)</Label>
                            <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/5 min-h-[300px]">
                                <RichTextEditor
                                    content={editingTutorial?.description || ''}
                                    onChange={content => setEditingTutorial(prev => ({ ...prev, description: content }))}
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-4 border-t border-white/10">
                            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="rounded-2xl uppercase tracking-widest text-[10px] font-bold h-12 px-6" data-testid="tutorialmanager-cancel-button">
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isPending} className="rounded-2xl gap-2 h-12 px-8 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20" data-testid="tutorialmanager-save-button">
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Guardar Tutorial
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!previewTutorial} onOpenChange={open => !open && setPreviewTutorial(null)}>
                <DialogContent className="max-w-6xl h-[90vh] lg:h-auto lg:max-h-[85vh] bg-neutral-950 border-white/10 rounded-[2.5rem] overflow-hidden p-0 flex flex-col lg:flex-row shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)]">
                    {previewTutorial && (
                        <>
                            <DialogHeader className="sr-only">
                                <DialogTitle>{previewTutorial.title}</DialogTitle>
                                <DialogDescription>Previsualización del video tutorial</DialogDescription>
                            </DialogHeader>
                            
                            {/* Video Section */}
                            <div className="w-full lg:w-[65%] bg-black flex items-center justify-center p-2 lg:p-4">
                                <div className="w-full h-full rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
                                    <VideoPlayer url={previewTutorial.videoUrl} title={previewTutorial.title} className="h-full w-full aspect-auto" />
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="w-full lg:w-[35%] flex flex-col border-t lg:border-t-0 lg:border-l border-white/10 bg-neutral-900/50 backdrop-blur-xl">
                                <ScrollArea className="flex-1">
                                    <div className="p-8 space-y-6">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-black uppercase tracking-widest rounded-lg px-3 py-1">
                                                    {previewTutorial.category}
                                                </Badge>
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">Tutorial Oficial</span>
                                            </div>
                                            <h3 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-tight">
                                                {previewTutorial.title}
                                            </h3>
                                        </div>

                                        <Separator className="bg-white/5" />

                                        <div className="space-y-4">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-primary/80 flex items-center gap-2">
                                                <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                                                Instrucciones del Proceso
                                            </div>
                                            <div 
                                                className="prose prose-invert prose-sm max-w-none text-slate-400 font-medium leading-relaxed
                                                prose-headings:uppercase prose-headings:italic prose-headings:font-black prose-headings:tracking-tighter prose-headings:text-white
                                                prose-p:mb-4 prose-strong:text-white prose-strong:font-black prose-li:text-slate-400 prose-blockquote:border-primary
                                                prose-ol:pl-4 prose-ul:pl-4"
                                                dangerouslySetInnerHTML={{ __html: previewTutorial.description }} 
                                            />
                                        </div>
                                    </div>
                                </ScrollArea>
                                
                                {/* Footer Info */}
                                <div className="p-6 border-t border-white/5 bg-black/20 text-center">
                                    <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-600">
                                        Go Motel - Sistema de Gestión de Operaciones
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
