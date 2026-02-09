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
import { Check, LogIn, LogOut, PlusCircle, ConciergeBell, History, User, Users, Bed, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import CheckInDialog from '@/components/room-detail/CheckInDialog'
import OrderServiceDialog from '@/components/room-detail/OrderServiceDialog'
import CheckoutDialog from '@/components/room-detail/CheckoutDialog'
import { getServices } from '@/lib/actions/service.actions'
import { updateRoomStatus } from '@/lib/actions/room.actions'
import { realtimeOrderStatusUpdates } from '@/ai/flows/realtime-order-status-updates'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'


function InfoRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined, icon: React.ElementType }) {
    return (
        <div className="flex items-start">
            <Icon className="h-5 w-5 text-muted-foreground mr-3 mt-1 flex-shrink-0" />
            <div>
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <p className="text-base font-semibold">{value || 'N/D'}</p>
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
            <div className="space-y-6">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    if (!room) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Habitación No Encontrada</CardTitle>
                    <CardDescription>La habitación que busca no existe.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    const renderRoomActions = () => {
        switch (room.status) {
            case 'Available':
                return (
                    <CheckInDialog roomId={room.id}>
                        <Button size="lg" className="w-full">
                            <LogIn className="mr-2 h-5 w-5" /> Registrar Huésped
                        </Button>
                    </CheckInDialog>
                )
            case 'Occupied':
                return (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <OrderServiceDialog stayId={stay?.id} availableServices={availableServices}>
                            <Button size="lg" className="flex-1">
                                <PlusCircle className="mr-2 h-5 w-5" /> Pedir Servicio
                            </Button>
                        </OrderServiceDialog>
                        <CheckoutDialog stay={stay} room={room} orders={orders}>
                            <Button size="lg" variant="destructive" className="flex-1">
                                <LogOut className="mr-2 h-5 w-5" /> Realizar Check-Out
                            </Button>
                        </CheckoutDialog>
                    </div>
                )
            case 'Cleaning':
            case 'Maintenance':
                return (
                    <Button size="lg" className="w-full" onClick={handleSetAvailable}>
                        <Check className="mr-2 h-5 w-5" /> Marcar como Disponible
                    </Button>
                )
            default:
                return null
        }
    }


    return (
        <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-4xl">Habitación {room.number}</CardTitle>
                                <CardDescription>Tarifa: ${room.ratePerHour}/hora</CardDescription>
                            </div>
                            <StatusBadge status={room.status} />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-4">
                            <InfoRow label="Tipo" value={room.type} icon={Bed} />
                            <InfoRow label="Capacidad" value={`${room.capacity} persona(s)`} icon={Users} />
                            {room.description && <InfoRow label="Descripción" value={room.description} icon={Info} />}
                        </div>

                        {stay && (
                            <div className="space-y-4 border-t pt-4 mt-4">
                                <InfoRow label="Nombre del Huésped" value={stay.guestName} icon={User} />
                                <InfoRow label="Hora de Check-In" value={stay.checkIn ? format(stay.checkIn.toDate(), 'PPpp', { locale: es }) : 'N/D'} icon={LogIn} />
                            </div>
                        )}
                        <div className="pt-4">{renderRoomActions()}</div>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-2 space-y-6">
                 {room.status === 'Occupied' && stay && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalles de la Estancia Actual</CardTitle>
                            <CardDescription>Servicios y pedidos para el huésped actual.</CardDescription>
                        </CardHeader>
                        <CardContent>
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
                                                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                             <div className="text-right font-semibold mt-2 pt-2 border-t">Total: ${order.total.toFixed(2)}</div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <ConciergeBell className="mx-auto h-12 w-12" />
                                    <p className="mt-2">Aún no se han pedido servicios para esta estancia.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
