'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useUserProfile } from '@/hooks/use-user-profile';
import type { FeedbackTicket } from '@/types';
import { updateFeedbackStatus } from '@/lib/actions/feedback.actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  MessageSquareWarning, 
  Sparkles, 
  Mail, 
  Phone, 
  MessageCircle, 
  Clock, 
  CheckCircle, 
  ShieldAlert,
  Inbox,
  Search,
  Filter,
  CheckCheck,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function AdminFeedbackPage() {
  const { firestore } = useFirebase();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'Pendiente' | 'Revisado' | 'Resuelto' | 'All'>('Pendiente');
  const [filterType, setFilterType] = useState<'All' | 'Queja' | 'Mejora de Servicio'>('All');
  const [searchTerm, setSearchTerm] = useState('');

  const ticketsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'feedbackTickets'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: tickets, isLoading: isLoadingTickets } = useCollection<FeedbackTicket>(ticketsQuery);

  // Counts
  const counts = useMemo(() => {
    if (!tickets) return { total: 0, pending: 0, reviewed: 0, resolved: 0, quejas: 0, mejoras: 0 };
    return {
      total: tickets.length,
      pending: tickets.filter(t => t.status === 'Pendiente').length,
      reviewed: tickets.filter(t => t.status === 'Revisado').length,
      resolved: tickets.filter(t => t.status === 'Resuelto').length,
      quejas: tickets.filter(t => t.type === 'Queja').length,
      mejoras: tickets.filter(t => t.type === 'Mejora de Servicio').length,
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter(t => {
      // Tab filter
      if (activeTab !== 'All' && t.status !== activeTab) return false;
      // Type filter
      if (filterType !== 'All' && t.type !== filterType) return false;
      // Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesSubject = t.subject?.toLowerCase().includes(term);
        const matchesDetails = t.details.toLowerCase().includes(term);
        const matchesEmail = t.email?.toLowerCase().includes(term);
        const matchesPhone = t.phone?.includes(term) || t.whatsapp?.includes(term);
        if (!matchesSubject && !matchesDetails && !matchesEmail && !matchesPhone) return false;
      }
      return true;
    });
  }, [tickets, activeTab, filterType, searchTerm]);

  if (isProfileLoading || isLoadingTickets) {
    return (
      <div className="mx-auto w-full max-w-[1600px] p-6 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (userProfile?.role !== 'Administrador') {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <ShieldAlert className="h-16 w-16 text-rose-500 mx-auto" />
        <h2 className="text-2xl font-black uppercase text-white">Acceso Restringido</h2>
        <p className="text-sm text-slate-400">
          Solo los usuarios con rol de Administrador pueden revisar las Quejas o Sugerencias de Servicio.
        </p>
        <Button asChild className="rounded-xl mt-4">
          <Link href="/dashboard">Volver al Dashboard</Link>
        </Button>
      </div>
    );
  }

  const handleUpdateStatus = async (ticketId: string, newStatus: 'Revisado' | 'Resuelto') => {
    const reviewerName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Administrador';
    const res = await updateFeedbackStatus(ticketId, newStatus, reviewerName);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: 'Estado actualizado', description: `El registro ha sido marcado como ${newStatus}.` });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Inbox className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">
              Buzón de Quejas y Sugerencias
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Gestión organizada de comentarios de clientes (Exclusivo Administradores).
            </p>
          </div>
        </div>

        {counts.pending > 0 && (
          <div className="px-4 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-black uppercase tracking-wider flex items-center gap-2 animate-pulse">
            <AlertCircle className="h-4 w-4" />
            {counts.pending} {counts.pending === 1 ? 'Solicitud sin revisar' : 'Solicitudes sin revisar'}
          </div>
        )}
      </div>

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          onClick={() => setActiveTab('Pendiente')}
          className={cn(
            "p-5 rounded-2xl border transition-all cursor-pointer",
            activeTab === 'Pendiente'
              ? "bg-rose-500/10 border-rose-500 shadow-lg shadow-rose-500/10"
              : "bg-slate-900/60 border-white/10 hover:bg-slate-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Sin Revisar (Pendientes)</span>
            <AlertCircle className="h-4 w-4 text-rose-400" />
          </div>
          <p className="text-3xl font-black text-white mt-2 font-mono">{counts.pending}</p>
        </Card>

        <Card 
          onClick={() => setActiveTab('Revisado')}
          className={cn(
            "p-5 rounded-2xl border transition-all cursor-pointer",
            activeTab === 'Revisado'
              ? "bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10"
              : "bg-slate-900/60 border-white/10 hover:bg-slate-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">En Revisión</span>
            <Clock className="h-4 w-4 text-blue-400" />
          </div>
          <p className="text-3xl font-black text-white mt-2 font-mono">{counts.reviewed}</p>
        </Card>

        <Card 
          onClick={() => setActiveTab('Resuelto')}
          className={cn(
            "p-5 rounded-2xl border transition-all cursor-pointer",
            activeTab === 'Resuelto'
              ? "bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/10"
              : "bg-slate-900/60 border-white/10 hover:bg-slate-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Resueltos</span>
            <CheckCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-white mt-2 font-mono">{counts.resolved}</p>
        </Card>

        <Card 
          onClick={() => setActiveTab('All')}
          className={cn(
            "p-5 rounded-2xl border transition-all cursor-pointer",
            activeTab === 'All'
              ? "bg-primary/10 border-primary shadow-lg shadow-primary/10"
              : "bg-slate-900/60 border-white/10 hover:bg-slate-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Registros</span>
            <Inbox className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-3xl font-black text-white mt-2 font-mono">{counts.total}</p>
        </Card>
      </div>

      {/* Tabs and Controls Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-hide">
          {[
            { id: 'Pendiente', label: 'Sin Revisar', count: counts.pending, color: 'text-rose-400' },
            { id: 'Revisado', label: 'En Revisión', count: counts.reviewed, color: 'text-blue-400' },
            { id: 'Resuelto', label: 'Resueltos', count: counts.resolved, color: 'text-emerald-400' },
            { id: 'All', label: 'Todos', count: counts.total, color: 'text-slate-400' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-white/10 text-white border border-white/20 shadow-md scale-105"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <span>{tab.label}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] bg-black/40 font-mono font-bold", tab.color)}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filters and Search */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-200 focus:outline-none"
          >
            <option value="All">Todas las Categorías</option>
            <option value="Queja">Solo Quejas ({counts.quejas})</option>
            <option value="Mejora de Servicio">Solo Mejoras ({counts.mejoras})</option>
          </select>

          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por contacto o asunto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-9 bg-white/5 border-white/10 text-xs text-white rounded-xl placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Tickets Grid */}
      {!filteredTickets || filteredTickets.length === 0 ? (
        <Card className="p-16 text-center bg-slate-900/40 border-white/10 space-y-3 rounded-3xl">
          <Inbox className="h-12 w-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white uppercase">Sin Registros en esta Vista</h3>
          <p className="text-xs text-slate-400">
            No se encontraron quejas o sugerencias con los criterios de búsqueda seleccionados.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTickets.map((ticket) => {
            const dateObj = ticket.createdAt?.toDate ? ticket.createdAt.toDate() : (ticket.createdAt?.seconds ? new Date(ticket.createdAt.seconds * 1000) : new Date());
            const formattedDate = format(dateObj, "d 'de' MMMM, yyyy - hh:mm a", { locale: es });

            return (
              <Card key={ticket.id} className="bg-slate-900/60 border-white/10 overflow-hidden rounded-3xl shadow-xl flex flex-col justify-between hover:border-white/20 transition-all">
                <CardHeader className="p-6 border-b border-white/5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      {ticket.type === 'Queja' ? (
                        <Badge variant="outline" className="bg-rose-500/10 border-rose-500/30 text-rose-400 font-black uppercase tracking-wider text-[10px] px-3 py-1">
                          <MessageSquareWarning className="h-3.5 w-3.5 mr-1" /> Queja
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-400 font-black uppercase tracking-wider text-[10px] px-3 py-1">
                          <Sparkles className="h-3.5 w-3.5 mr-1" /> Mejora de Servicio
                        </Badge>
                      )}

                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "font-black text-[10px] uppercase px-2.5 py-0.5",
                          ticket.status === 'Pendiente' && "bg-rose-500/20 text-rose-300 border border-rose-500/30",
                          ticket.status === 'Revisado' && "bg-blue-500/20 text-blue-300 border border-blue-500/30",
                          ticket.status === 'Resuelto' && "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        )}
                      >
                        {ticket.status === 'Pendiente' ? 'Sin Revisar' : ticket.status}
                      </Badge>
                    </div>

                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formattedDate}
                    </span>
                  </div>

                  <CardTitle className="text-lg font-black text-white pt-3">
                    {ticket.subject || (ticket.type === 'Queja' ? 'Queja de Servicio' : 'Sugerencia de Mejora')}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-6 space-y-6 flex-1">
                  {/* Detail text */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {ticket.details}
                  </div>

                  {/* Contact information */}
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Datos de Contacto del Cliente:</span>
                    <div className="flex flex-wrap gap-4 text-xs font-mono">
                      {ticket.email && (
                        <a href={`mailto:${ticket.email}`} className="flex items-center gap-1.5 text-primary hover:underline">
                          <Mail className="h-3.5 w-3.5" /> {ticket.email}
                        </a>
                      )}
                      {ticket.phone && (
                        <a href={`tel:${ticket.phone.replace(/[^0-9+]/g, '')}`} className="flex items-center gap-1.5 text-slate-300 hover:text-white">
                          <Phone className="h-3.5 w-3.5" /> {ticket.phone}
                        </a>
                      )}
                      {ticket.whatsapp && (
                        <a 
                          href={`https://wa.me/${ticket.whatsapp.replace(/[^0-9]/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center gap-1.5 text-emerald-400 hover:underline"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> {ticket.whatsapp} (WhatsApp)
                        </a>
                      )}
                      {!ticket.email && !ticket.phone && !ticket.whatsapp && (
                        <span className="text-slate-500 italic">Cliente no proporcionó datos de contacto (Anónimo).</span>
                      )}
                    </div>
                  </div>

                  {ticket.reviewedBy && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1 border-t border-white/5">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                      Atendido por {ticket.reviewedBy}
                    </div>
                  )}
                </CardContent>

                {/* Actions Bar */}
                <div className="p-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-end gap-2">
                  {ticket.status !== 'Revisado' && ticket.status !== 'Resuelto' && (
                    <Button 
                      size="sm" 
                      onClick={() => handleUpdateStatus(ticket.id, 'Revisado')}
                      className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      <Clock className="h-3.5 w-3.5 mr-1" /> Marcar En Revisión
                    </Button>
                  )}
                  {ticket.status !== 'Resuelto' && (
                    <Button 
                      size="sm" 
                      onClick={() => handleUpdateStatus(ticket.id, 'Resuelto')}
                      className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      <CheckCheck className="h-3.5 w-3.5 mr-1" /> Marcar Resuelto
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
