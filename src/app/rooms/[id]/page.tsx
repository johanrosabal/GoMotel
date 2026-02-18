'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { doc, onSnapshot, Timestamp, collection, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Room, Stay, Order, Service } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { Button } from '@/components/ui/button'
import { Check, LogIn, LogOut, PlusCircle, ConciergeBell, History, User, Users, Bed, Info, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import CheckInDialog from '@/components/room-detail/CheckInDialog'
import OrderServiceDialog from '@/components/room-detail/OrderServiceDialog'
import CheckoutDialog from '@/components/room-detail/CheckoutDialog'
import { getServices } from '@/lib/actions/service.actions'
import { updateRoomStatus } from '@/lib/actions/room.actions'
import { realtimeOrderStatusUpdates } from '@/ai/flows/realtime-order-status-updates'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'


function InfoRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined, icon: React.ElementType }) {
    return (
        <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                 <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{label}</p>
                <p className="text-sm font-bold">{value || 'N/D'}</p>
            </div>
        </div>
    )
}

export default function RoomDetailsPage() {
    const params = useParams()
    const roomId = params.id as string
    const [room, setRoom] = useState<Room | null>(null)
    const [stay, setStay] = useState<Stay | null>(null)
    const [orders, setOrders] = useState<Order[]>([])
    const [availableServices, setAvailableServices] = useState<Service[]>([])
    const [loading, setLoading] = useState(true)
    const { toast } = useToast()
    const [timeInStatus, setTimeInStatus] = useState('');

    useEffect(() => {
        if (!roomId) return

        const roomUnsub = onSnapshot(doc(db, 'rooms', roomId), (doc) => {
            if (doc.exists()) {
                const data = doc.data()
                const roomData: Room = { 
                    id: doc.id,
                    ...data,
                    number: data.number,
                    status: data.status,
                    ratePerHour: data.ratePerHour,
                    type: data.type || 'Sencilla',
                    capacity: data.capacity || 1,
                    description: data.description || '',
                    statusUpdatedAt: data.statusUpdatedAt,
                } as Room;
                setRoom(roomData)
                if (!roomData.currentStayId) {
                    setStay(null)
                    setOrders([])
                }
            } else {
                toast({ title: 'Error', description: 'Habitación no encontrada.', variant: 'destructive' })
            }
            setLoading(false)
        })

        getServices().then(setAvailableServices)

        return () => roomUnsub()
    }, [roomId, toast])


    useEffect(() => {
        if (!room?.currentStayId) return

        const stayUnsub = onSnapshot(doc(db, 'stays', room.currentStayId), (doc) => {
            if (doc.exists()) {
                setStay({ id: doc.id, ...doc.data() } as Stay)
            }
        })
        
        const ordersQuery = query(collection(db, 'orders'), where('stayId', '==', room.currentStayId));
        const ordersUnsub = onSnapshot(ordersQuery, (snapshot) => {
            const newOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
            newOrders.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
            setOrders(newOrders);
        });

        return () => {
            stayUnsub();
            ordersUnsub();
        }
    }, [room?.currentStayId])

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

    const handleSetAvailable = async () => {
        if (!room) return
        const result = await updateRoomStatus(room.id, 'Available')
        if (result.success) {
            toast({ title: 'Éxito', description: 'La habitación ahora está disponible.' })
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' })
        }
    }
    
    const checkAiOrderStatus = async (order: Order) => {
        toast({ title: "Consultando IA", description: "Obteniendo estado del pedido de la IA..." });
        const result = await realtimeOrderStatusUpdates({ roomNumber: room?.number || 'Unknown' });
        toast({ title: `Estado IA para Hab. ${room?.number}`, description: `Estado: ${result.orderStatus}, Artículos: ${result.items}` });
    }

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

    if (!room) {
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

    const renderRoomActions = () => {
        switch (room.status) {
            case 'Available':
                return (
                    <CheckInDialog roomId={room.id}>
                        <Button size="lg" className="w-full h-14 sm:h-11 text-base sm:text-sm">
                            <LogIn className="mr-2 h-5 w-5" /> Registrar Huésped
                        </Button>
                    </CheckInDialog>
                )
            case 'Occupied':
                return (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <OrderServiceDialog stayId={stay?.id} availableServices={availableServices}>
                            <Button size="lg" className="flex-1 h-14 sm:h-11 text-base sm:text-sm">
                                <PlusCircle className="mr-2 h-5 w-5" /> Pedir Servicio
                            </Button>
                        </OrderServiceDialog>
                        <CheckoutDialog stay={stay} room={room} orders={orders}>
                            <Button size="lg" variant="destructive" className="flex-1 h-14 sm:h-11 text-base sm:text-sm">
                                <LogOut className="mr-2 h-5 w-5" /> Realizar Check-Out
                            </Button>
                        </CheckoutDialog>
                    </div>
                )
            case 'Cleaning':
            case 'Maintenance':
                return (
                    <Button size="lg" className="w-full h-14 sm:h-11 text-base sm:text-sm" onClick={handleSetAvailable}>
                        <Check className="mr-2 h-5 w-5" /> Marcar como Disponible
                    </Button>
                )
            default:
                return null
        }
    }


    return (
        <div className="container py-4 sm:py-6 lg:py-8">
            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-5xl font-bold">Habitación {room.number}</CardTitle>
                                    <CardDescription>Tarifa: {formatCurrency(room.ratePerHour)}/hora</CardDescription>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <StatusBadge status={room.status} />
                                    {room.status === 'Cleaning' && timeInStatus && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1" title={`Iniciado el ${room.statusUpdatedAt?.toDate().toLocaleString()}`}>
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
                                        <InfoRow label="Hora de Check-In" value={stay.checkIn ? format(stay.checkIn.toDate(), 'PPpp', { locale: es }) : 'N/D'} icon={LogIn} />
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
                                {orders.length > 0 ? (
                                    <ul className="space-y-4">
                                        {orders.map(order => (
                                            <li key={order.id} className="p-3 border rounded-lg bg-muted/50">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className='flex items-center gap-2'>
                                                        <History className="w-4 h-4 text-muted-foreground" />
                                                        <p className="text-sm font-medium">Pedido - {format(order.createdAt.toDate(), 'p', { locale: es })}</p>
                                                    </div>
                                                    <Button variant="ghost" size="sm" onClick={() => checkAiOrderStatus(order)}>Consultar Estado IA</Button>
                                                </div>
                                                <ul className="pl-6 space-y-1 text-sm">
                                                    {order.items.map(item => (
                                                        <li key={item.serviceId} className="flex justify-between">
                                                            <span>{item.quantity}x {item.name}</span>
                                                            <span>{formatCurrency(item.price * item.quantity)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                                <div className="text-right font-semibold mt-2 pt-2 border-t">Total: {formatCurrency(order.total)}</div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground rounded-lg border-2 border-dashed">
                                        <ConciergeBell className="mx-auto h-12 w-12" />
                                        <p className="mt-4">Aún no se han pedido servicios para esta estancia.</p>
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
        </div>
    )
}
