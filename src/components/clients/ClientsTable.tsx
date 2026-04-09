'use client';

import { useState, useMemo, useTransition } from 'react';
import type { Client } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash2, Star, ShieldCheck, ShieldX } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AddClientDialog from './AddClientDialog';
import { deleteClient } from '@/lib/actions/client.actions';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Phone, Mail, CreditCard, Calendar, UserCheck } from 'lucide-react';

function ActionsMenu({ client }: { client: Client }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const handleDelete = () => {
        setIsDeleteDialogOpen(false);
        startTransition(async () => {
            const result = await deleteClient(client.id);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Cliente Eliminado', description: 'El cliente ha sido eliminado exitosamente.' });
            }
        });
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isPending} className="h-10 w-10 bg-white/5 border border-white/10 hover:bg-primary/20 hover:text-primary transition-all rounded-xl shrink-0" id="clientstable-button-1" data-testid="clientstable-button-1">
                        <MoreHorizontal className="h-5 w-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#0f0f0f] border-white/10 backdrop-blur-2xl text-white">
                    <DropdownMenuLabel className="font-black uppercase tracking-widest text-[9px] text-slate-500">Acciones de Huésped</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)} className="focus:bg-white/5 focus:text-primary cursor-pointer transition-colors px-4 py-3">
                        <Edit className="mr-3 h-4 w-4" />
                        <span className="font-bold text-xs uppercase tracking-widest">Editar Perfil</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem onSelect={() => setIsDeleteDialogOpen(true)} className="text-rose-500 focus:bg-rose-500/10 focus:text-rose-500 cursor-pointer transition-colors px-4 py-3">
                        <Trash2 className="mr-3 h-4 w-4" />
                        <span className="font-bold text-xs uppercase tracking-widest">Eliminar Registro</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            
            <AddClientDialog client={client} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente la ficha del cliente {client.firstName} {client.lastName}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cerrar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isPending ? "Eliminando..." : "Confirmar Eliminación"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export default function ClientsTable({ clients, searchTerm }: { clients: Client[], searchTerm: string }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const searchContent = `${client.firstName} ${client.lastName} ${client.email} ${client.idCard}`.toLowerCase();
      return searchContent.includes(searchTerm.toLowerCase());
    });
  }, [clients, searchTerm]);

  return (
    <div className="space-y-4">
       {filteredClients.length === 0 ? (
        <div className="text-center text-slate-500 py-32 bg-white/5 backdrop-blur-xl border-2 border-dashed border-white/10 rounded-[3rem] shadow-2xl">
            <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-black uppercase tracking-[0.3em] text-xs italic">No se encontraron huéspedes en la base de datos.</p>
        </div>
      ) : (
        <>
            {/* Mobile & Tablet View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:hidden">
                {filteredClients.map(client => (
                <Card 
                    key={client.id} 
                    className={cn(
                        "flex flex-col relative transition-all duration-500 h-full group bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden hover:scale-[1.02] hover:bg-white/[0.08] p-8", 
                        client.isVip && 'border-l-[6px] border-l-amber-500 shadow-amber-500/20 shadow-2xl'
                    )}
                    onMouseMove={handleMouseMove}
                >
                    {/* Dynamic Spotlight Effect */}
                    <div 
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0"
                        style={{
                            background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.06), transparent 40%)`
                        }}
                    />

                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-14 w-14 ring-4 ring-white/5 border-2 border-primary/20">
                                <AvatarFallback className="bg-black text-primary font-black">{client.firstName?.[0]}{client.lastName?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <CardTitle className="text-xl font-black uppercase italic tracking-tighter text-white group-hover:text-primary transition-colors flex items-center gap-2">
                                    {client.firstName} {client.lastName}
                                    {client.isVip && <Star className="h-4 w-4 text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />}
                                </CardTitle>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mt-1 italic">
                                    <Mail className="h-3 w-3" /> {client.email}
                                </p>
                            </div>
                        </div>
                        <ActionsMenu client={client} />
                    </div>

                    <div className="grid grid-cols-2 gap-6 relative z-10">
                        <div className="space-y-1">
                            <p className="font-black text-[9px] uppercase tracking-widest text-slate-600 flex items-center gap-2">
                                <Phone className="h-3 w-3" /> Contacto
                            </p>
                            <p className="font-bold text-xs text-white uppercase">{client.phoneNumber}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="font-black text-[9px] uppercase tracking-widest text-slate-600 flex items-center gap-2">
                                <CreditCard className="h-3 w-3" /> Identificación
                            </p>
                            <p className="font-mono text-xs text-white uppercase tracking-tighter font-black">{client.idCard}</p>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-3">
                            {client.isValidated ? (
                                <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Verificado</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                    <ShieldX className="h-3.5 w-3.5" />
                                    <span className="text-[9px] font-black uppercase tracking-widest italic text-slate-400">Verificar</span>
                                </div>
                            )}
                        </div>
                        <div className="text-right">
                             <p className="font-black text-[8px] uppercase tracking-[0.2em] text-slate-600">Visitas Totales</p>
                             <p className="font-black text-lg text-primary leading-none mt-1">{client.visitCount || 0}</p>
                        </div>
                    </div>
                </Card>
                ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block rounded-[3rem] border border-white/10 overflow-hidden bg-white/5 backdrop-blur-xl shadow-2xl">
                <Table>
                <TableHeader className="bg-white/5 h-20">
                    <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 pl-10 leading-none">Huésped</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Canal de Contacto</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Cédula</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Estado</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Activo Desde</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Visitas</TableHead>
                    <TableHead className="text-right pr-10"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredClients.map(client => (
                    <TableRow 
                        key={client.id} 
                        className={cn(
                            "border-white/5 transition-all duration-300 group hover:bg-white/5 h-24",
                            client.isVip && 'bg-amber-500/5'
                        )}
                    >
                        <TableCell className="pl-10">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-white/10 transition-transform group-hover:scale-110">
                                <AvatarFallback className="bg-black text-primary font-black text-xs">{client.firstName?.[0]}{client.lastName?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-black text-white uppercase italic tracking-tighter text-sm flex items-center gap-2 group-hover:text-primary transition-colors">
                                    {client.firstName} {client.lastName}
                                    {client.isVip && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />}
                                </div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest italic mt-0.5">{client.email}</div>
                            </div>
                        </div>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-300 uppercase italic tracking-widest">{client.phoneNumber}</TableCell>
                        <TableCell>
                        <div className="font-mono text-xs text-slate-400 font-black uppercase tracking-tight">{client.idCard}</div>
                        </TableCell>
                        <TableCell>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="inline-flex items-center justify-center transition-transform hover:scale-125">
                                            {client.isValidated ? (
                                                <ShieldCheck className="h-6 w-6 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]" />
                                            ) : (
                                                <ShieldX className="h-6 w-6 text-slate-700" />
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-[#0f0f0f] border-white/10 text-white rounded-xl">
                                        <p className="font-bold text-[10px] uppercase tracking-widest px-2 py-1">{client.isValidated ? 'Identidad Verificada' : 'Pendiente de Verificación'}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{format(client.createdAt.toDate(), 'dd MMM yyyy', { locale: es })}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-slate-600" />
                                <span className="font-black text-sm text-primary">{client.visitCount || 0}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right pr-10">
                            <ActionsMenu client={client} />
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
        </>
      )}
    </div>
  );
}

    