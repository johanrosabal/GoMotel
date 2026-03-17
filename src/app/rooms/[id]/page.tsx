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
import { Check, LogIn, LogOut, PlusCircle, ConciergeBell, History, User, Users, Bed, Info, Clock, AlertTriangle, Repeat, ArrowLeft, CalendarPlus, ChevronsUpDown, CreditCard, Wallet, Smartphone } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import CreateReservationDialog from '@/components/reservations/CreateReservationDialog'
import OrderServiceDialog from '@/components/room-detail/OrderServiceDialog'
import CheckoutDialog from '@/components/room-detail/CheckoutDialog'
import { getServices } from '@/lib/actions/service.actions'
import { updateRoomStatus } from '@/lib/actions/room.actions'
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


function InfoRow({ label, value, icon: Icon, children }: { label: string; value?: string | null | undefined, icon: React.ElementType, children?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                 <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{label}</p>
                <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{value || 'N/D'}</p>
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

    // Facturación global para evitar desmonte por cambio de estado
    const [successInvoiceId, setSuccessInvoiceId] = useState<string | null>(null);
    const [isSuccessOpen, setIsSuccessOpen] = useState(false);

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

            checkOverdue(); // Check immediately
            const interval = setInterval(checkOverdue, 30000); // And every 30 seconds
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
                setProgress(Math.min(100, calculatedProgress)); // Cap at 100%
            };
    
            calculateProgress();
            const interval = setInterval(calculateProgress, 60000); // Update every minute
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
            <div className="container py-4 sm:py-6 lg:py-8">
                <div className="grid md:grid-cols-3 gap-6">
                    <Skeleton className="h-96 w-full md:col-span-1" />
                    <Skeleton className="h-96 w-full md:col-span-2" />
                </div>
            </div>
        )
    }

    if (!room && !loading) {
        return (
            <div className="container py-4 sm:py-6 lg:py-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Habitación No Encontrada</CardTitle>
                        <CardDescription>La habitación que busca no existe.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }
    
    if (!room) return null; // Should not happen if loading is false, but for TS safety.

    const renderRoomActions = () => {
        switch (room.status) {
            case 'Available':
                return (
                    <CreateReservationDialog isWalkIn initialRoomId={room.id}>
                        <Button className="w-full h-16 sm:h-12 text-base sm:text-sm">
                            <LogIn className="mr-2 h-5 w-5" /> Registrar Huésped
                        </Button>
                    </CreateReservationDialog>
                )
            case 'Occupied':
                return (
                    <div className="space-y-2">
                        <OrderServiceDialog stayId={stay?.id} availableServices={availableServices} onOrderSuccess={handleInvoiceSuccess}>
                            <Button className="w-full h-12 text-base sm:text-sm">
                                <PlusCircle className="mr-2 h-5 w-5" /> Pedir Servicio
                            </Button>
                        </OrderServiceDialog>

                        {isOverdue && stay && (
                           <ExtendStayDialog room={room} stay={stay} isOverdue={isOverdue} onExtensionSuccess={handleInvoiceSuccess}>
                               <Button variant="destructive" className="w-full h-12 text-base sm:text-sm animate-pulse">
                                   <AlertTriangle className="mr-2 h-5 w-5" /> Gestionar Estancia Vencida
                               </Button>
                           </ExtendStayDialog>
                        )}
                        
                        <CheckoutDialog stay={stay} room={room} orders={activeOrders || []} onCheckoutSuccess={handleInvoiceSuccess}>
                            <Button variant="destructive" className="w-full h-12 text-base sm:text-sm">
                                <LogOut className="mr-2 h-5 w-5" /> Realizar Check-Out
                            </Button>
                        </CheckoutDialog>
                    </div>
                )
            case 'Cleaning':
            case 'Maintenance':
                return (
                    <Button className="w-full h-16 sm:h-12 text-base sm:text-sm" onClick={handleSetAvailable}>
                        <Check className="mr-2 h-5 w-5" /> Marcar como Disponible
                    </Button>
                )
            default:
                return null
        }
    }


    return (
        <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
            <div className="flex items-center justify-end gap-2">
                <Button asChild variant="outline">
                    <Link href="/reservations">
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        Ir a Reservaciones
                    </Link>
                </Button>
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                </Button>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-1 space-y-6">
                    <Card className={cn(isOverdue && 'animate-overdue-pulse')}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <CardTitle className="text-3xl font-bold">Habitación {room.number}</CardTitle>
                                    {stay && (
                                        <div className="flex">
                                            <Badge 
                                                variant={stay.paymentStatus === 'Pagado' ? 'default' : 'outline'} 
                                                className={cn(
                                                    "text-[10px] font-black uppercase tracking-[0.1em] px-2.5 py-1 h-auto rounded-md shadow-sm border-2",
                                                    stay.paymentStatus === 'Pagado' 
                                                        ? "bg-green-600 text-white border-green-700 shadow-sm" 
                                                        : "text-amber-700 border-amber-500 bg-amber-50 dark:bg-amber-950/20 shadow-sm"
                                                )}
                                            >
                                                {stay.paymentStatus === 'Pagado' ? 'Hospedaje Pagado' : 'Hospedaje Pendiente'}
                                            </Badge>
                                        </div>
                                    )}
                                    <CardDescription className="text-sm font-medium">
                                        Tarifa: {formatCurrency(room.ratePerHour)} / hora
                                    </CardDescription>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <StatusBadge status={room.status} isOverdue={isOverdue} />
                                    {room.status === 'Cleaning' && timeInStatus && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1" title={`Iniciado el ${room.statusUpdatedAt ? format(room.statusUpdatedAt.toDate(), "dd MMM yyyy, h:mm a", { locale: es }) : ''}`}>
                                        <Clock className="h-3 w-3" />
                                        {timeInStatus}
                                    </div>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4">
                                <InfoRow label="Tipo" value={room.roomTypeName} icon={Bed} />
                                <InfoRow label="Capacidad" value={`${room.capacity} persona(s)`} icon={Users} />
                                {room.description && <InfoRow label="Descripción" value={room.description} icon={Info} />}
                            </div>

                            {stay && (
                                <>
                                    <Separator />
                                    <div className="grid gap-4">
                                        <InfoRow label="Nombre del Huésped" value={stay.guestName} icon={User} />

                                        {stay.paymentStatus === 'Pagado' && (
                                            <div className="flex items-center gap-2 ml-14 -mt-2">
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                                                    {stay.paymentMethod === 'Efectivo' && <Wallet className="h-3 w-3" />}
                                                    {stay.paymentMethod === 'Sinpe Movil' && <Smartphone className="h-3 w-3" />}
                                                    {stay.paymentMethod === 'Tarjeta' && <CreditCard className="h-3 w-3" />}
                                                    <span>{stay.paymentMethod}</span>
                                                    {stay.voucherNumber && <span className="opacity-60">— {stay.voucherNumber}</span>}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {stay?.extensionHistory && stay.extensionHistory.length > 0 && (
                                            <Collapsible>
                                                <div className="flex items-start justify-between">
                                                    <InfoRow label="Renovaciones" value={`${stay.extensionHistory.length} ${stay.extensionHistory.length > 1 ? 'veces' : 'vez'}`} icon={Repeat} />
                                                    <CollapsibleTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="mt-3 -mr-2">
                                                            <ChevronsUpDown className="h-4 w-4" />
                                                            <span className="sr-only">Mostrar/Ocultar Historial</span>
                                                        </Button>
                                                    </CollapsibleTrigger>
                                                </div>
                                                <CollapsibleContent>
                                                    <ul className="mt-2 space-y-3 pl-14 pb-2">
                                                        {stay.extensionHistory.slice().reverse().map((ext, index) => (
                                                            <li key={index} className="text-xs relative pl-4">
                                                                <span className="absolute left-0 top-1 h-1.5 w-1.5 rounded-full bg-primary/40"></span>
                                                                <div className="font-semibold text-sm">
                                                                    {ext.planName} <span className="text-muted-foreground">({formatCurrency(ext.planPrice)})</span>
                                                                </div>
                                                                <div className="text-muted-foreground">
                                                                    <span>Extendido el {format(ext.extendedAt.toDate(), 'dd MMM, h:mm a', { locale: es })}</span>
                                                                    <br />
                                                                    <span>Salida movida de {format(ext.oldExpectedCheckOut.toDate(), 'h:mm a', { locale: es })} a <span className="font-semibold text-foreground">{format(ext.newExpectedCheckOut.toDate(), 'h:mm a', { locale: es })}</span></span>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        )}

                                        <div className="space-y-2">
                                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Línea de Timeline de Estancia</p>
                                            <Progress value={progress} className="h-3" />
                                            <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                                                <div>
                                                    <p>Check-in</p>
                                                    <p className="font-bold text-foreground">{stay.checkIn ? format(stay.checkIn.toDate(), 'h:mm a', { locale: es }) : 'N/D'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p>Check-out</p>
                                                    <p className="font-bold text-foreground">{stay.expectedCheckOut ? format(stay.expectedCheckOut.toDate(), 'h:mm a', { locale: es }) : 'N/D'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="pt-4">{renderRoomActions()}</div>
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-2">
                     <Card className="h-full flex flex-col">
                        <CardHeader>
                            <CardTitle>Detalles de la Estancia Actual</CardTitle>
                            <CardDescription>Servicios y pedidos para el huésped actual.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                             {room.status === 'Occupied' && stay ? (
                                <>
                                {activeOrders && activeOrders.length > 0 ? (
                                    <ul className="space-y-4">
                                        {activeOrders.map(order => (
                                            <li key={order.id} className="p-3 border rounded-lg bg-muted/50">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className='flex items-center gap-2'>
                                                        <History className="w-4 h-4 text-muted-foreground" />
                                                        <p className="text-sm font-medium">Pedido - {format(order.createdAt.toDate(), 'h:mm a', { locale: es })}</p>
                                                        <Badge variant={order.status === 'Entregado' ? 'default' : 'secondary'}>{order.status}</Badge>
                                                    </div>
                                                    <Button variant="ghost" size="sm" onClick={() => handleCancelOrder(order.id)} disabled={isCancelling} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                        {isCancelling ? 'Cancelando...' : 'Remover'}
                                                    </Button>
                                                </div>
                                                <ul className="pl-6 space-y-1 text-sm">
                                                    {order.items.map(item => (
                                                        <li key={item.serviceId} className="flex justify-between items-center group">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold">{item.quantity}x</span>
                                                                <span className="uppercase">{item.name}</span>
                                                                {item.category === 'Food' && <Badge variant="outline" className="text-[9px] h-4 uppercase">{order.kitchenStatus}</Badge>}
                                                                {item.category === 'Beverage' && <Badge variant="outline" className="text-[9px] h-4 uppercase">{order.barStatus}</Badge>}
                                                            </div>
                                                            <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                                <div className="text-right font-bold mt-2 pt-2 border-t text-primary">Total: {formatCurrency(order.total)}</div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground rounded-lg border-2 border-dashed p-6">
                                        <ConciergeBell className="mx-auto h-12 w-12" />
                                        <p className="mt-4 mb-6">Aún no se han pedido servicios para esta estancia.</p>
                                        <OrderServiceDialog stayId={stay?.id} availableServices={availableServices} onOrderSuccess={handleInvoiceSuccess}>
                                            <Button>
                                                <PlusCircle className="mr-2 h-4 w-4" />
                                                Añadir Pedido
                                            </Button>
                                        </OrderServiceDialog>
                                    </div>
                                )}
                                </>
                            ) : (
                                 <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground rounded-lg border-2 border-dashed">
                                    <p>No hay una estancia activa en esta habitación.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
            {/* Modal de Factura Global para persistir después del check-out */}
            <InvoiceSuccessDialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen} invoiceId={successInvoiceId} />
        </div>
    )
}
