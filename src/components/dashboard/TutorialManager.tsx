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
    Info as InfoIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveTutorial, deleteTutorial } from '@/lib/actions/tutorial.actions';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Badge } from '@/components/ui/badge';
import type { Tutorial } from '@/types';
import { useUserProfile } from '@/hooks/use-user-profile';
import { MediaUpload } from '@/components/ui/media-upload';

interface TutorialManagerProps {
    initialTutorials: Tutorial[];
}

export default function TutorialManager({ initialTutorials }: TutorialManagerProps) {
    const { userProfile, isLoading } = useUserProfile();
    const [tutorials, setTutorials] = useState<Tutorial[]>(initialTutorials);
    const [isPending, startTransition] = useTransition();
    const [isOpen, setIsOpen] = useState(false);
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
                <Button onClick={() => handleEdit(null)} className="rounded-2xl gap-2 h-12 px-6 font-bold uppercase tracking-widest text-[10px]" data-testid="tutorialmanager-new-button">
                    <Plus className="h-4 w-4" /> Nuevo Tutorial
                </Button>
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
                                    <a href={t.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-primary flex items-center gap-1 transition-colors" data-testid="tutorialmanager-action-link">
                                        <ExternalLink className="h-3 w-3" /> Ver Archivo
                                    </a>
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
        </div>
    );
}
