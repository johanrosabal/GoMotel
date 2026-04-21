'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { doc, collection, query, where, orderBy } from 'firebase/firestore'
import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase'
import type { Room, Stay, Order, Service } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { Button } from '@/components/ui/button'
import { Check, LogIn, LogOut, PlusCircle, ConciergeBell, History, User, Users, Bed, Info, Clock, AlertTriangle, Repeat, ArrowLeft, CalendarPlus, ChevronsUpDown, CreditCard, Wallet, Smartphone, ReceiptText, LayoutGrid, Zap, Sparkles, Tv } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import CreateReservationDialog from '@/components/reservations/CreateReservationDialog'
import OrderServiceDialog from '@/components/room-detail/OrderServiceDialog'
import CheckoutDialog from '@/components/room-detail/CheckoutDialog'
import { getServices } from '@/lib/actions/service.actions'
import { updateRoomStatus, checkOut } from '@/lib/actions/room.actions'
import { cancelOrder } from '@/lib/actions/order.actions'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency, cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import ExtendStayDialog from '@/components/room-detail/ExtendStayDialog'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from '@/components/ui/badge'
import InvoiceSuccessDialog from '@/components/reservations/InvoiceSuccessDialog'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'


function InfoRow({ label, value, icon: Icon, children }: { label: string; value?: string | null | undefined, icon: React.ElementType, children?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-4 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 border border-white/5 text-slate-400 group-hover:text-primary transition-colors shadow-inner">
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">{label}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm font-bold text-slate-200">{value || 'N/D'}</p>
                    {children}
                </div>
            </div>
        </div>
    )
}

export default function RoomDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const roomId = params.id as string

    const [availableServices, setAvailableServices] = useState<Service[]>([])
    const { toast } = useToast()
    const [timeInStatus, setTimeInStatus] = useState('');
    const [isOverdue, setIsOverdue] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isCancelling, startCancelTransition] = useTransition();

    const [successInvoiceId, setSuccessInvoiceId] = useState<string | null>(null);
    const [isSuccessOpen, setIsSuccessOpen] = useState(false);
    const [isCheckingOut, startCheckoutTransition] = useTransition();

    const handleDirectCheckout = () => {
        if (!stay || !room) return;
        
        startCheckoutTransition(async () => {
            const result = await checkOut(stay.id, room.id, {
                paymentMethod: 'Efectivo',
                amountPaid: 0,
            });

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Éxito!', description: 'Check-out completado correctamente.' });
                router.push('/dashboard/rooms');
            }
        });
    };

    const handleInvoiceSuccess = (id: string) => {
        setSuccessInvoiceId(id);
        setIsSuccessOpen(true);
    };

    const { firestore } = useFirebase();

    const roomRef = useMemoFirebase(() => {
        if (!firestore || !roomId) return null;
        return doc(firestore, 'rooms', roomId);
    }, [firestore, roomId]);
    const { data: room, isLoading: isLoadingRoom } = useDoc<Room>(roomRef);

    const stayRef = useMemoFirebase(() => {
        if (!firestore || !room?.currentStayId) return null;
        return doc(firestore, 'stays', room.currentStayId);
    }, [firestore, room?.currentStayId]);
    const { data: stay, isLoading: isLoadingStay } = useDoc<Stay>(stayRef);

    const ordersQuery = useMemoFirebase(() => {
        if (!firestore || !stay?.id) return null;
        return query(collection(firestore, 'orders'), where('stayId', '==', stay.id), orderBy('createdAt', 'desc'));
    }, [firestore, stay?.id]);

    const { data: allOrders, isLoading: isLoadingOrders } = useCollection<Order>(ordersQuery);

    const activeOrders = useMemo(() => {
        return allOrders?.filter(o => o.status !== 'Cancelado') || [];
    }, [allOrders]);

    const financialSummary = useMemo(() => {
        if (!stay) return null;
        const roomTotal = stay.pricePlanAmount || 0;
        const unpaidOrders = activeOrders.filter(o => o.paymentStatus !== 'Pagado');
        const servicesSubtotal = unpaidOrders.reduce((sum, o) => sum + (o.subtotal || o.total), 0);
        const servicesTaxes = unpaidOrders.reduce((sum, o) => sum + (o.total - (o.subtotal || o.total)), 0);
        const upfrontPaid = stay.paymentAmount || 0;

        const totalStay = roomTotal + servicesSubtotal + servicesTaxes;
        const netDue = Math.max(0, totalStay - upfrontPaid);

        return { roomTotal, servicesSubtotal, servicesTaxes, totalStay, upfrontPaid, netDue };
    }, [stay, activeOrders]);

    const loading = isLoadingRoom || (!!room && !!room.currentStayId ? (isLoadingStay || isLoadingOrders) : false);

    useEffect(() => {
        getServices().then(setAvailableServices)
    }, [])

    useEffect(() => {
        let intervalId: NodeJS.Timeout | undefined;

        if (room?.status === 'Cleaning' && room.statusUpdatedAt) {
            const update = () => {
                setTimeInStatus(formatDistanceToNowStrict(room.statusUpdatedAt.toDate(), { locale: es }));
            };
            update();
            intervalId = setInterval(update, 60000); // update every minute
        } else {
            setTimeInStatus('');
        }

        return () => clearInterval(intervalId);
    }, [room?.status, room?.statusUpdatedAt]);

    useEffect(() => {
        if (stay && room?.status === 'Occupied') {
            const checkOverdue = () => {
                const now = new Date();
                const isStayOverdue = stay.expectedCheckOut.toDate() < now;
                setIsOverdue(isStayOverdue);
            };

            checkOverdue();
            const interval = setInterval(checkOverdue, 30000);
            return () => clearInterval(interval);
        } else {
            setIsOverdue(false);
        }
    }, [stay, room?.status]);

    useEffect(() => {
        if (stay && room?.status === 'Occupied') {
            const calculateProgress = () => {
                const now = new Date();
                const checkInTime = stay.checkIn.toDate();
                const expectedCheckOutTime = stay.expectedCheckOut.toDate();

                if (now >= expectedCheckOutTime) {
                    setProgress(100);
                    return;
                }
                if (now < checkInTime) {
                    setProgress(0);
                    return;
                }

                const totalDuration = expectedCheckOutTime.getTime() - checkInTime.getTime();
                const elapsedTime = now.getTime() - checkInTime.getTime();

                const calculatedProgress = (elapsedTime / totalDuration) * 100;
                setProgress(Math.min(100, calculatedProgress));
            };

            calculateProgress();
            const interval = setInterval(calculateProgress, 60000);
            return () => clearInterval(interval);
        } else {
            setProgress(0);
        }
    }, [stay, room?.status]);


    const handleSetAvailable = async () => {
        if (!room) return
        const result = await updateRoomStatus(room.id, 'Available')
        if (result.success) {
            toast({ title: 'Éxito', description: 'La habitación ahora está disponible.' })
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' })
        }
    }

    const handleCancelOrder = (orderId: string) => {
        startCancelTransition(async () => {
            const result = await cancelOrder(orderId);
            if (result.error) {
                toast({ title: 'Error al cancelar', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Pedido Cancelado', description: 'El pedido ha sido removido de la cuenta.' });
            }
        });
    };

    if (loading) {
        return (
            <div className="container py-8 flex flex-col gap-8">
                 <div className="flex justify-end gap-2 h-12">
                    <Skeleton className="h-full w-40 rounded-full" />
                    <Skeleton className="h-full w-40 rounded-full" />
                 </div>
                <div className="grid md:grid-cols-3 gap-8">
                    <Skeleton className="h-[600px] w-full md:col-span-1 rounded-[2.5rem]" />
                    <Skeleton className="h-[600px] w-full md:col-span-2 rounded-[2.5rem]" />
                </div>
            </div>
        )
    }

    if (!room && !loading) {
        return (
            <div className="container py-12 flex justify-center">
                <Card className="max-w-md w-full bg-slate-950/40 backdrop-blur-2xl border-white/10 rounded-[2.5rem]">
                    <CardHeader className="text-center py-12">
                        <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
                        <CardTitle className="text-2xl font-black uppercase italic tracking-tighter">Habitación No Encontrada</CardTitle>
                        <CardDescription className="text-slate-400">La habitación que busca no existe o ha sido removida.</CardDescription>
                        <Button asChild variant="outline" className="mt-8 rounded-full h-12 px-8" id="page-button-4" data-testid="id-back-button">
                            <Link href="/dashboard/rooms"><ArrowLeft className="mr-2 h-4 w-4" /> Regresar al Panel</Link>
                        </Button>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    if (!room) return null;

    const renderRoomActions = () => {
        switch (room.status) {
            case 'Available':
                return (
                    <CreateReservationDialog isWalkIn initialRoomId={room.id}>
                        <Button className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] rounded-2xl bg-primary hover:bg-primary/90 text-black shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]" id="page-button-registrar-hu-sped" data-testid="id-action-save-guest-button">
                            <LogIn className="mr-2 h-5 w-5" /> Registrar Huésped
                        </Button>
                    </CreateReservationDialog>
                )
            case 'Occupied':
                return (
                    <div className="space-y-3">
                        <OrderServiceDialog stayId={stay?.id} availableServices={availableServices} onOrderSuccess={handleInvoiceSuccess}>
                            <Button className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] rounded-2xl bg-primary hover:bg-primary/90 text-black shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]" id="page-button-pedir-servicio" data-testid="id-add-button">
                                <PlusCircle className="mr-2 h-5 w-5" /> Pedir Servicio
                            </Button>
                        </OrderServiceDialog>

                        {isOverdue && stay && (
                            <ExtendStayDialog room={room} stay={stay} isOverdue={isOverdue} onExtensionSuccess={handleInvoiceSuccess}>
                                <Button variant="destructive" className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-rose-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]" id="page-button-gestionar-estancia-vencida" data-testid="id-action-checkout-expired-button">
                                    <AlertTriangle className="mr-2 h-5 w-5" /> Gestionar Vencida
                                </Button>
                            </ExtendStayDialog>
                        )}

                        {financialSummary?.netDue === 0 ? (
                            <Button 
                                variant="outline" 
                                className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] rounded-2xl border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]" 
                                onClick={handleDirectCheckout}
                                disabled={isCheckingOut}
                                id="page-button-checkout-directo"
                                data-testid="id-action-checkout-direct-button"
                            >
                                <LogOut className="mr-2 h-5 w-5" /> 
                                {isCheckingOut ? 'Procesando...' : 'Realizar Check-Out'}
                            </Button>
                        ) : (
                            <CheckoutDialog stay={stay} room={room} orders={activeOrders || []} onCheckoutSuccess={handleInvoiceSuccess}>
                                <Button variant="outline" className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] rounded-2xl border-rose-500/50 text-rose-500 hover:bg-rose-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]" id="page-button-realizar-check-out" data-testid="id-action-checkout-button">
                                    <LogOut className="mr-2 h-5 w-5" /> Realizar Check-Out
                                </Button>
                            </CheckoutDialog>
                        )}
                    </div>
                )
            case 'Cleaning':
            case 'Maintenance':
                return (
                    <Button className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] rounded-2xl bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]" onClick={handleSetAvailable} id="page-button-marcar-como-disponible" data-testid="id-action-mark-available-button">
                        <Check className="mr-2 h-5 w-5" /> Marcar como Disponible
                    </Button>
                )
            default:
                return null
        }
    }


    return (
        <div className="relative min-h-[calc(100vh-4rem)] bg-neutral-950 overflow-hidden">
             {/* Cinematic Background */}
            <div className="fixed inset-0 z-0">
                <Image 
                    src="/motel_exterior_night_1773958134736.png" 
                    alt="Cinematic Background" 
                    fill 
                    className="object-cover opacity-60 scale-105"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/40 to-black/95" />
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="container relative z-10 py-6 sm:py-8 lg:py-12 space-y-8"
            >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(255,255,255,0.05)]">
                            <Sparkles className="h-3 w-3" />
                            Detalle En Tiempo Real
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3 whitespace-nowrap">
                                <Bed className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
                                Gestión de Suite
                            </h1>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 flex-wrap">
                        <Button asChild variant="secondary" className="rounded-full font-black uppercase tracking-widest text-[9px] h-11 px-6 border border-white/10 shadow-xl transition-all hover:scale-105 active:scale-95 bg-slate-900/50 backdrop-blur-md" id="page-button-panel-habitaciones" data-testid="id-rooms-panel-link">
                            <Link href="/dashboard/rooms">
                                <LayoutGrid className="mr-2 h-4 w-4 text-primary" />
                                Panel de Habitaciones
                            </Link>
                        </Button>
                        <Button asChild variant="secondary" className="rounded-full font-black uppercase tracking-widest text-[9px] h-11 px-6 border border-white/10 shadow-xl transition-all hover:scale-105 active:scale-95 bg-slate-900/50 backdrop-blur-md" id="page-button-1" data-testid="id-action-button">
                            <Link href="/reservations" id="page-link-ir-a-reservaciones" data-testid="id-reservations-link">
                                <CalendarPlus className="mr-2 h-4 w-4 text-primary" />
                                Ir a Reservaciones
                            </Link>
                        </Button>
                        <Button variant="secondary" onClick={() => router.back()} className="rounded-full font-black uppercase tracking-widest text-[9px] h-11 px-6 border border-white/10 shadow-xl transition-all hover:scale-105 active:scale-95 bg-slate-900/50 backdrop-blur-md" id="page-button-volver" data-testid="id-back-button">
                            <ArrowLeft className="mr-2 h-4 w-4 text-primary" />
                            Volver
                        </Button>
                    </div>
                </div>

                <div className="grid gap-8 md:grid-cols-3">
                    <div className="md:col-span-1 space-y-8">
                        <Card className={cn(
                            "bg-slate-950/40 backdrop-blur-3xl border-white/10 shadow-2xl rounded-[2.5rem] overflow-hidden transition-all duration-500",
                            isOverdue ? 'border-rose-500 shadow-[0_0_20px_rgba(251,113,133,0.3)]' : 'border-t-white/20'
                        )}>
                            <CardHeader className="p-8 pb-4">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1">
                                            <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] whitespace-nowrap">Habitación {room.number}</CardTitle>
                                            <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Suite {room.roomTypeName}</CardDescription>
                                        </div>
                                    </div>
                                    {stay && (
                                        <div className="flex">
                                            <Badge
                                                variant={stay.paymentStatus === 'Pagado' ? 'default' : 'outline'}
                                                className={cn(
                                                    "text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 h-auto rounded-full shadow-lg border-2",
                                                    stay.paymentStatus === 'Pagado'
                                                        ? "bg-emerald-500 text-black border-emerald-600 shadow-emerald-500/20"
                                                        : "text-amber-400 border-amber-500/30 bg-amber-500/10 shadow-amber-500/10"
                                                )}
                                            >
                                                {stay.paymentStatus === 'Pagado' ? 'Hospedaje Pagado' : 'Hospedaje Pendiente'}
                                            </Badge>
                                        </div>
                                    )}
                                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tarifa Base</span>
                                        <span className="text-sm font-bold text-slate-200">{formatCurrency(room.ratePerHour)} <span className="text-[10px] text-slate-500 lowercase">/ h</span></span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 px-1">
                                        <StatusBadge status={room.status} isOverdue={isOverdue} />
                                        
                                        {stay?.remoteControlDelivered && (
                                            <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 whitespace-nowrap">
                                                <Tv className="h-3 w-3" />
                                                Control Entregado
                                            </div>
                                        )}

                                        {room.status === 'Cleaning' && timeInStatus && (
                                            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 whitespace-nowrap">
                                                <Clock className="h-3 w-3" />
                                                {timeInStatus}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 pt-4 space-y-8">
                                <div className="grid gap-5">
                                    <InfoRow label="Capacidad" value={`${room.capacity} persona(s)`} icon={Users} />
                                    {room.description && <InfoRow label="Descripción" value={room.description} icon={Info} />}
                                </div>

                                {stay && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="space-y-8 pt-4 border-t border-white/5"
                                    >
                                        <div className="grid gap-5">
                                            <InfoRow label="Huésped Principal" value={stay.guestName} icon={User}>
                                                {room.isClientConfirmed && (
                                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-[8px] font-black uppercase animate-pulse">
                                                        V.I.P
                                                    </span>
                                                )}
                                            </InfoRow>

                                            {stay.paymentStatus === 'Pagado' && (
                                                <div className="flex items-center gap-2 ml-16 -mt-2">
                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                        {stay.paymentMethod === 'Efectivo' && <Wallet className="h-3 w-3 text-emerald-400" />}
                                                        {stay.paymentMethod === 'Sinpe Movil' && <Smartphone className="h-3 w-3 text-blue-400" />}
                                                        {stay.paymentMethod === 'Tarjeta' && <CreditCard className="h-3 w-3 text-purple-400" />}
                                                        <span>{stay.paymentMethod}</span>
                                                        {stay.voucherNumber && <span className="text-white/40">— #{stay.voucherNumber}</span>}
                                                    </div>
                                                </div>
                                            )}

                                            {stay?.extensionHistory && stay.extensionHistory.length > 0 && (
                                                <Collapsible>
                                                    <div className="flex items-start justify-between">
                                                        <InfoRow label="Renovaciones" value={`${stay.extensionHistory.length} Ciclos`} icon={Repeat} />
                                                        <CollapsibleTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="mt-3 -mr-2 text-primary hover:bg-primary/10 rounded-xl" id="page-button-2" data-testid="id-action-hide-show-history-button">
                                                                <ChevronsUpDown className="h-4 w-4" />
                                                            </Button>
                                                        </CollapsibleTrigger>
                                                    </div>
                                                    <CollapsibleContent>
                                                        <ul className="mt-4 space-y-4 pl-16 pb-2 border-l-2 border-primary/20 ml-6">
                                                            {stay.extensionHistory.slice().reverse().map((ext, index) => (
                                                                <li key={index} className="text-xs relative group">
                                                                    <div className="font-bold text-slate-200">
                                                                        {ext.planName} <span className="text-primary/70 text-[10px] ml-2">{formatCurrency(ext.planPrice)}</span>
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500 font-medium">
                                                                        <span>{format(ext.extendedAt.toDate(), 'dd MMM, HH:mm', { locale: es })}</span>
                                                                        <div className="mt-1 flex items-center gap-2">
                                                                             <Clock className="w-2.5 h-2.5" />
                                                                             <span>{format(ext.oldExpectedCheckOut.toDate(), 'HH:mm', { locale: es })} → <span className="text-white font-bold">{format(ext.newExpectedCheckOut.toDate(), 'HH:mm', { locale: es })}</span></span>
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </CollapsibleContent>
                                                </Collapsible>
                                            )}

                                            <div className="space-y-3 pt-2">
                                                <div className="flex justify-between items-end">
                                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Tiempo en Suite</p>
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400">
                                                        <Zap className="h-3 w-3 text-primary animate-pulse" />
                                                        {Math.round(progress)}%
                                                    </div>
                                                </div>
                                                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/5 border border-white/5 p-0.5">
                                                    <motion.div 
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${progress}%` }}
                                                        className={cn(
                                                            "h-full rounded-full bg-gradient-to-r shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all ease-out duration-1000",
                                                            progress > 90 ? "from-rose-600 to-rose-400" : "from-primary to-primary/60"
                                                        )} 
                                                    />
                                                </div>
                                                <div className="flex justify-between text-[9px] text-slate-500 font-black uppercase tracking-widest pt-1 px-1">
                                                    <div className="flex flex-col">
                                                        <span className="opacity-50">Entrada</span>
                                                        <span className="text-slate-200 text-xs mt-0.5">{stay.checkIn ? format(stay.checkIn.toDate(), 'HH:mm', { locale: es }) : '--:--'}</span>
                                                    </div>
                                                    <div className="flex flex-col text-right">
                                                        <span className="opacity-50">Salida Est.</span>
                                                        <span className={cn("text-xs mt-0.5", isOverdue ? "text-rose-500 font-black animate-pulse" : "text-slate-200")}>
                                                            {stay.expectedCheckOut ? format(stay.expectedCheckOut.toDate(), 'HH:mm', { locale: es }) : '--:--'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                <div className="pt-4">{renderRoomActions()}</div>
                            </CardContent>
                        </Card>

                        {financialSummary && room.status === 'Occupied' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                <Card className="bg-slate-950/60 backdrop-blur-3xl border-primary/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[2.5rem] overflow-hidden relative group">
                                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <ReceiptText className="h-24 w-24 text-primary" />
                                    </div>
                                    <CardHeader className="pb-3 p-8">
                                        <CardTitle className="text-xs font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2">
                                            <Zap className="h-4 w-4" />
                                            Estado de Cuenta
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6 p-8 pt-0">
                                        <div className="space-y-3 text-[10px] font-bold uppercase tracking-widest">
                                            <div className="flex justify-between text-slate-500">
                                                <span>Subtotal Suite:</span>
                                                <span className="text-slate-200">{formatCurrency(financialSummary.roomTotal)}</span>
                                            </div>
                                            <div className="flex justify-between text-slate-500">
                                                <span>Consumos y Pedidos:</span>
                                                <span className="text-slate-200">{formatCurrency(financialSummary.servicesSubtotal)}</span>
                                            </div>
                                            <div className="flex justify-between text-slate-500">
                                                <span>Tasas de Servicio:</span>
                                                <span className="text-slate-200">{formatCurrency(financialSummary.servicesTaxes)}</span>
                                            </div>
                                            
                                            {financialSummary.upfrontPaid > 0 && (
                                                <div className="flex justify-between text-emerald-500 pt-2">
                                                    <span>Pagos Anticipados:</span>
                                                    <span className="font-black">-{formatCurrency(financialSummary.upfrontPaid)}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-6 border-t border-white/10">
                                            <div className="flex flex-col gap-1 text-right">
                                                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary/60">Saldo Pendiente</span>
                                                <span className={cn(
                                                    "text-4xl font-black tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]",
                                                    financialSummary.netDue === 0 ? "text-emerald-500" : "text-white"
                                                )}>
                                                    {formatCurrency(financialSummary.netDue)}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </div>

                    <div className="md:col-span-2">
                        <Card className="bg-slate-950/40 backdrop-blur-3xl border-white/10 shadow-2xl rounded-[2.5rem] overflow-hidden flex flex-col h-full border-t-white/20">
                            <CardHeader className="p-8 border-b border-white/5 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg sm:text-2xl font-black uppercase italic tracking-tight text-white flex items-center gap-3 whitespace-nowrap">
                                        <ConciergeBell className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
                                        Estancia Actual
                                    </CardTitle>
                                    <CardDescription className="text-slate-400 mt-1">Servicios, productos y pedidos asociados a la suite.</CardDescription>
                                </div>
                                {room.status === 'Occupied' && stay && (
                                     <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5">
                                        <History className="h-5 w-5 text-slate-400" />
                                     </div>
                                )}
                            </CardHeader>
                            <CardContent className="p-8 flex-grow">
                                {room.status === 'Occupied' && stay ? (
                                    <AnimatePresence mode="popLayout">
                                        {activeOrders && activeOrders.length > 0 ? (
                                            <motion.ul 
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="space-y-6"
                                            >
                                                {activeOrders.map(order => (
                                                    <motion.li 
                                                        key={order.id} 
                                                        layout
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className="p-6 border rounded-[1.5rem] bg-white/[0.02] backdrop-blur-md shadow-xl border-white/5 group hover:border-primary/20 transition-all"
                                                    >
                                                        <div className="flex justify-between items-center mb-5">
                                                            <div className='flex items-center gap-3'>
                                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                                                    <ReceiptText className="w-5 h-5 text-primary" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pedido #{format(order.createdAt.toDate(), 'HH:mm')}</p>
                                                                    <div className="flex gap-2 items-center mt-1">
                                                                        <Badge variant={order.status === 'Entregado' ? 'default' : 'secondary'} className={cn("text-[9px] h-5 px-2 font-bold uppercase", order.status === 'Entregado' ? 'bg-emerald-500' : 'bg-slate-700/50')}>{order.status}</Badge>
                                                                        {order.paymentStatus === 'Pagado' && <Badge className="text-[9px] h-5 px-2 bg-blue-600 font-bold uppercase">Pagado</Badge>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                onClick={() => handleCancelOrder(order.id)} 
                                                                disabled={isCancelling} 
                                                                className="h-9 px-4 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 font-black uppercase text-[10px] tracking-widest rounded-full opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0" 
                                                                id="page-button-3" 
                                                                data-testid="id-action-is-cancel-button"
                                                            >
                                                                {isCancelling ? '...' : 'Remover'}
                                                            </Button>
                                                        </div>
                                                        
                                                        <ul className="space-y-3 mb-6">
                                                            {order.items.map(item => (
                                                                <li key={item.serviceId} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                                                    <div className="flex items-center gap-4">
                                                                        <span className="font-black text-xs text-primary bg-primary/10 w-7 h-7 flex items-center justify-center rounded-lg">{item.quantity}</span>
                                                                        <div className="flex flex-col">
                                                                            <span className="uppercase text-[11px] font-black tracking-wide text-slate-200">{item.name}</span>
                                                                            <div className="flex gap-2 items-center mt-0.5">
                                                                                {item.category === 'Food' && <span className="text-[8px] font-bold text-orange-400 uppercase tracking-widest flex items-center gap-1"><Zap className="h-2 w-2" /> {order.kitchenStatus}</span>}
                                                                                {item.category === 'Beverage' && <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1"><Clock className="h-2 w-2" /> {order.barStatus}</span>}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <span className="font-bold text-xs text-slate-400">{formatCurrency(item.price * item.quantity)}</span>
                                                                </li>
                                                            ))}
                                                        </ul>

                                                        <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Total Pedido</span>
                                                                <span className="text-xl font-black text-white tracking-tighter">{formatCurrency(order.total)}</span>
                                                            </div>
                                                            <div className="opacity-30 group-hover:opacity-100 transition-opacity">
                                                                <ArrowLeft className="h-4 w-4 text-primary rotate-180" />
                                                            </div>
                                                        </div>
                                                    </motion.li>
                                                ))}
                                            </motion.ul>
                                        ) : (
                                            <motion.div 
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="flex h-full flex-col items-center justify-center text-center p-12 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-black/10"
                                            >
                                                <div className="relative mb-8">
                                                    <div className="absolute inset-0 blur-3xl bg-primary/20 animate-pulse" />
                                                    <ConciergeBell className="h-20 w-20 text-primary relative z-10" />
                                                </div>
                                                <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-200 mb-2">Servicio en Pausa</h3>
                                                <p className="text-slate-500 max-w-xs mx-auto text-sm font-medium leading-relaxed">
                                                    Aún no se han solicitado servicios ni productos para esta estancia.
                                                </p>
                                                <OrderServiceDialog stayId={stay?.id} availableServices={availableServices} onOrderSuccess={handleInvoiceSuccess}>
                                                    <Button className="mt-8 rounded-full h-14 px-8 bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 transition-all hover:scale-105" id="page-button-a-adir-pedido" data-testid="id-add-order-button">
                                                        <PlusCircle className="mr-2 h-5 w-5" />
                                                        Solicitar Servicio
                                                    </Button>
                                                </OrderServiceDialog>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                ) : (
                                    <div className="flex h-full flex-col items-center justify-center text-center p-12 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-black/10">
                                        <div className="h-16 w-16 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center mb-6">
                                            <Bed className="h-8 w-8 text-slate-600" />
                                        </div>
                                        <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-400">Sin Estancia Activa</h3>
                                        <p className="text-slate-600 text-xs font-bold uppercase tracking-widest mt-2">La suite está lista para una nueva reservación</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
                <InvoiceSuccessDialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen} invoiceId={successInvoiceId} />
            </motion.div>
        </div>
    )
}
