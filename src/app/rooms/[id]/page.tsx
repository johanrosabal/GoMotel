'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { doc, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Room, Stay, Order } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { Button } from '@/components/ui/button'
import { Check, LogIn, LogOut, PlusCircle, ConciergeBell, History, HandCoins } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import CheckInDialog from '@/components/room-detail/CheckInDialog'
import OrderServiceDialog from '@/components/room-detail/OrderServiceDialog'
import CheckoutDialog from '@/components/room-detail/CheckoutDialog'
import { getServices } from '@/lib/actions/service.actions'
import { getOrdersForStay, getStayById } from '@/lib/actions/order.actions'
import { updateRoomStatus } from '@/lib/actions/room.actions'
import { realtimeOrderStatusUpdates } from '@/ai/flows/realtime-order-status-updates'
import { format } from 'date-fns'


function InfoRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined, icon: React.ElementType }) {
    return (
        <div className="flex items-start">
            <Icon className="h-5 w-5 text-muted-foreground mr-3 mt-1 flex-shrink-0" />
            <div>
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <p className="text-base font-semibold">{value || 'N/A'}</p>
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
                const roomData = { id: doc.id, ...doc.data() } as Room
                setRoom(roomData)
                if (!roomData.currentStayId) {
                    setStay(null)
                    setOrders([])
                }
            } else {
                toast({ title: 'Error', description: 'Room not found.', variant: 'destructive' })
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
        
        const ordersQuery = query(collection(db, 'orders'), where('stayId', '==', room.currentStayId), orderBy('createdAt', 'desc'));
        const ordersUnsub = onSnapshot(ordersQuery, (snapshot) => {
            const newOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
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
            toast({ title: 'Success', description: 'Room is now available.' })
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' })
        }
    }
    
    const checkAiOrderStatus = async (order: Order) => {
        toast({ title: "Checking AI", description: "Getting order status from AI..." });
        const result = await realtimeOrderStatusUpdates({ roomNumber: room?.number || 'Unknown' });
        toast({ title: `AI Status for Room ${room?.number}`, description: `Status: ${result.orderStatus}, Items: ${result.items}` });
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
                    <CardTitle>Room Not Found</CardTitle>
                    <CardDescription>The room you are looking for does not exist.</CardDescription>
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
                            <LogIn className="mr-2 h-5 w-5" /> Check-In Guest
                        </Button>
                    </CheckInDialog>
                )
            case 'Occupied':
                return (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <OrderServiceDialog stayId={stay?.id} availableServices={availableServices}>
                            <Button size="lg" className="flex-1">
                                <PlusCircle className="mr-2 h-5 w-5" /> Order Service
                            </Button>
                        </OrderServiceDialog>
                        <CheckoutDialog stay={stay} room={room} orders={orders}>
                            <Button size="lg" variant="destructive" className="flex-1">
                                <LogOut className="mr-2 h-5 w-5" /> Check-Out
                            </Button>
                        </CheckoutDialog>
                    </div>
                )
            case 'Cleaning':
            case 'Maintenance':
                return (
                    <Button size="lg" className="w-full" onClick={handleSetAvailable}>
                        <Check className="mr-2 h-5 w-5" /> Mark as Available
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
                                <CardTitle className="text-4xl">Room {room.number}</CardTitle>
                                <CardDescription>Rate: ${room.ratePerHour}/hour</CardDescription>
                            </div>
                            <StatusBadge status={room.status} />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {stay && (
                            <div className="space-y-4">
                                <InfoRow label="Guest Name" value={stay.guestName} icon={User} />
                                <InfoRow label="Check-In Time" value={format(stay.checkIn.toDate(), 'PPpp')} icon={LogIn} />
                            </div>
                        )}
                        {renderRoomActions()}
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-2 space-y-6">
                 {room.status === 'Occupied' && stay && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Current Stay Details</CardTitle>
                            <CardDescription>Services and orders for the current guest.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             {orders.length > 0 ? (
                                <ul className="space-y-4">
                                    {orders.map(order => (
                                        <li key={order.id} className="p-3 border rounded-lg bg-muted/50">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className='flex items-center gap-2'>
                                                     <History className="w-4 h-4 text-muted-foreground" />
                                                    <p className="text-sm font-medium">Order - {format(order.createdAt.toDate(), 'p')}</p>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => checkAiOrderStatus(order)}>Ask AI Status</Button>
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
                                    <p className="mt-2">No services ordered for this stay yet.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
