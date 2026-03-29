
'use client';

import { useState, useEffect, useTransition } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  Bell, 
  BellOff, 
  Clock, 
  AlertCircle, 
  CheckCircle2,
  MoreHorizontal,
  Pencil
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
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
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  getNotifications, 
  saveNotification, 
  deleteNotification 
} from '@/lib/actions/notification.actions';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import type { AppNotification, NotificationType, NotificationPriority } from '@/types';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingNotif, setEditingNotif] = useState<Partial<AppNotification> | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const loadNotifications = async () => {
    setIsLoading(true);
    const data = await getNotifications();
    setNotifications(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNotif?.title || !editingNotif?.message || !editingNotif?.startDate || !editingNotif?.endDate) {
      toast({ title: 'Error', description: 'Complete todos los campos obligatorios', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      // Ensure we send serializable numbers
      const payload = {
        ...editingNotif,
        startDate: typeof editingNotif.startDate === 'object' ? (editingNotif.startDate as any).toMillis?.() || new Date(editingNotif.startDate as any).getTime() : editingNotif.startDate,
        endDate: typeof editingNotif.endDate === 'object' ? (editingNotif.endDate as any).toMillis?.() || new Date(editingNotif.endDate as any).getTime() : editingNotif.endDate,
      };

      const result = await saveNotification(payload);
      if (result.success) {
        toast({ title: 'Éxito', description: 'Notificación guardada correctamente' });
        setIsOpen(false);
        loadNotifications();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta notificación?')) return;
    const result = await deleteNotification(id);
    if (result.success) {
      toast({ title: 'Eliminado', description: 'La notificación ha sido eliminada' });
      loadNotifications();
    }
  };

  const getStatus = (notif: AppNotification) => {
    const now = Date.now();
    const start = typeof notif.startDate === 'number' ? notif.startDate : (notif.startDate as any).toMillis();
    const end = typeof notif.endDate === 'number' ? notif.endDate : (notif.endDate as any).toMillis();

    if (!notif.isActive) return { label: 'Inactiva', color: 'bg-neutral-500' };
    if (now < start) return { label: 'Programada', color: 'bg-blue-500' };
    if (now > end) return { label: 'Vencida', color: 'bg-amber-500' };
    return { label: 'Activa', color: 'bg-green-500' };
  };

  const renderTable = (type: NotificationType) => {
    const filtered = notifications.filter(n => n.type === type);

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título / Mensaje</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No hay notificaciones {type === 'Public' ? 'públicas' : 'internas'} registradas.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((notif) => {
                const status = getStatus(notif);
                return (
                  <TableRow key={notif.id}>
                    <TableCell>
                      <div className="font-bold">{notif.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1 truncate max-w-xs">{notif.message}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{new Date(typeof notif.startDate === 'number' ? notif.startDate : (notif.startDate as any).toMillis()).toLocaleString()}</div>
                      <div className="text-neutral-400">Hasta: {new Date(typeof notif.endDate === 'number' ? notif.endDate : (notif.endDate as any).toMillis()).toLocaleString()}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        notif.priority === 'High' ? 'text-red-500 border-red-500' :
                        notif.priority === 'Medium' ? 'text-amber-500 border-amber-500' :
                        'text-blue-500 border-blue-500'
                      )}>
                        {notif.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-white", status.color)}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setEditingNotif(notif);
                            setIsOpen(true);
                          }}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(notif.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="container py-8 space-y-8 max-w-7xl animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            Centro de Notificaciones
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Programe avisos informativos para clientes y personal administrativo.
          </p>
        </div>
        <Button onClick={() => {
          setEditingNotif({
            type: 'Public',
            priority: 'Low',
            isActive: true,
            startDate: Date.now() as any,
            endDate: (Date.now() + 86400000) as any // +1 day
          });
          setIsOpen(true);
        }} className="font-bold">
          <Plus className="mr-2 h-4 w-4" /> Nueva Notificación
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingNotif?.id ? 'Editar Notificación' : 'Crear Notificación'}</DialogTitle>
            <DialogDescription>
              Configure el contenido y el periodo de vigencia de su mensaje.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSave} className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Aviso</Label>
                <Select 
                  value={editingNotif?.type} 
                  onValueChange={(val: NotificationType) => setEditingNotif({...editingNotif, type: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Public">🌍 Público (Web Site)</SelectItem>
                    <SelectItem value="Internal">🏢 Interno (Dashboard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad / Color</Label>
                <Select 
                  value={editingNotif?.priority} 
                  onValueChange={(val: NotificationPriority) => setEditingNotif({...editingNotif, priority: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Informativa (Azul)</SelectItem>
                    <SelectItem value="Medium">Aviso (Naranja)</SelectItem>
                    <SelectItem value="High">Urgente (Rojo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título del Mensaje</Label>
              <Input 
                id="title" 
                placeholder="Ej: Mantenimiento programado" 
                value={editingNotif?.title || ''}
                onChange={(e) => setEditingNotif({...editingNotif, title: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Contenido del Aviso</Label>
              <Textarea 
                id="message" 
                placeholder="Escriba el detalle de la notificación..." 
                className="min-h-[100px]"
                value={editingNotif?.message || ''}
                onChange={(e) => setEditingNotif({...editingNotif, message: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Fecha de Inicio</Label>
                <Input 
                  id="start" 
                  type="datetime-local" 
                  value={editingNotif?.startDate ? new Date(typeof editingNotif.startDate === 'number' ? editingNotif.startDate : (editingNotif.startDate as any).toMillis?.() || Date.now()).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setEditingNotif({...editingNotif, startDate: new Date(e.target.value).getTime() as any})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Fecha de Fin</Label>
                <Input 
                  id="end" 
                  type="datetime-local" 
                  value={editingNotif?.endDate ? new Date(typeof editingNotif.endDate === 'number' ? editingNotif.endDate : (editingNotif.endDate as any).toMillis?.() || Date.now()).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setEditingNotif({...editingNotif, endDate: new Date(e.target.value).getTime() as any})}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4 bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-base">Notificación Activa</Label>
                <p className="text-sm text-muted-foreground">Si está desactivado, el aviso no se mostrará independientemente de las fechas.</p>
              </div>
              <Switch 
                checked={editingNotif?.isActive} 
                onCheckedChange={(val) => setEditingNotif({...editingNotif, isActive: val})} 
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending} className="font-bold">
                {isPending ? 'Guardando...' : editingNotif?.id ? 'Actualizar Aviso' : 'Publicar Aviso'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="public" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8 h-12">
          <TabsTrigger value="public" className="font-black tracking-widest text-[10px] uppercase">🌍 Notificaciones Públicas</TabsTrigger>
          <TabsTrigger value="internal" className="font-black tracking-widest text-[10px] uppercase">🏢 Notificaciones Internas</TabsTrigger>
        </TabsList>
        
        <TabsContent value="public">
          <Card className="border-primary/20 bg-primary/[0.01]">
            <CardHeader>
              <CardTitle className="text-primary text-xl font-black">Sitio Web Público</CardTitle>
              <CardDescription>Avisos que verán los clientes al ingresar a la plataforma.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="py-20 text-center animate-pulse">Cargando...</div> : renderTable('Public')}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="internal">
          <Card className="border-indigo-200 bg-indigo-50/10">
            <CardHeader>
              <CardTitle className="text-indigo-600 text-xl font-black">Sistema Interno (Staff)</CardTitle>
              <CardDescription>Mensajes dirigidos exclusivamente al personal del motel.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="py-20 text-center animate-pulse">Cargando...</div> : renderTable('Internal')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
