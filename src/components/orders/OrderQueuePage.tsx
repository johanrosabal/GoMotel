'use client';

import { useState, useEffect, useRef } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Order, OrderItem, PrepStatus } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, CheckCircle, Flame, ChefHat, GlassWater, Bell, MapPin } from 'lucide-react';
import { updateOrderStatus, updateOrderItemStatus } from '@/lib/actions/order.actions';
import { updateOrderItemStatus as updateRestaurantOrderItemStatus } from '@/lib/actions/restaurant.actions';
import { useToast } from '@/hooks/use-toast';
import { playNotificationSound } from '@/lib/sound';
import { cn } from '@/lib/utils';

interface OrderQueuePageProps {
    type: 'Kitchen' | 'Bar';
}

function OrderCard({ order, type, items }: { order: Order, type: 'Kitchen' | 'Bar', items: OrderItem[] }) {
    const [now, setNow] = useState(new Date());
    const { toast } = useToast();
    const [isUpdating, setIsUpdating] = useState(false);

    const currentAreaStatus = type === 'Kitchen' ? order.kitchenStatus : order.barStatus;

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const elapsedTime = now.getTime() - order.createdAt.toMillis();
    const minutes = Math.floor(elapsedTime / 60000);
    const isLate = minutes >= 15;

    const handleUpdateItemStatus = async (itemId: string, newStatus: PrepStatus) => {
        setIsUpdating(true);
        // Use the appropriate action based on location
        let result;
        if (order.locationType === 'Stay') {
            result = await updateOrderItemStatus(order.id, itemId, newStatus, type);
        } else {
            result = await updateRestaurantOrderItemStatus(order.id, itemId, newStatus, type);
        }
        setIsUpdating(false);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    return (
        <Card className={cn(
            "flex flex-col h-full border-2 transition-all duration-300",
            isLate && currentAreaStatus !== 'Entregado' ? "border-destructive shadow-destructive/20" : "border-border shadow-md",
            currentAreaStatus === 'En preparación' && "border-primary bg-primary/[0.02]"
        )}>
            <CardHeader className={cn(
                "p-4 border-b flex flex-col gap-2",
                isLate && currentAreaStatus !== 'Entregado' ? "bg-destructive/10" : "bg-muted/30"
            )}>
                <div className="flex items-start justify-between w-full">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {order.locationLabel || 'LLEVAR'}
                        </CardTitle>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">
                            Ticket: {order.id.slice(-5).toUpperCase()}
                        </p>
                    </div>
                    <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 font-black text-sm tabular-nums shadow-sm",
                        isLate ? "border-destructive bg-destructive text-destructive-foreground" : "border-primary/20 bg-primary/10 text-primary"
                    )}>
                        <Clock className="h-3.5 w-3.5" />
                        {Math.floor(elapsedTime / 60000)}:{(Math.floor(elapsedTime / 1000) % 60).toString().padStart(2, '0')}
                    </div>
                </div>
                {order.label && order.label !== order.locationLabel && (
                    <Badge variant="outline" className="w-fit text-[9px] font-black tracking-widest bg-background/50 border-primary/20 text-primary uppercase">
                        Cliente: {order.label}
                    </Badge>
                )}
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col">
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                        {items.map((item, idx) => (
                            <div key={item.id || idx} className={cn(
                                "space-y-2 p-3 rounded-2xl border-2 transition-all",
                                item.status === 'En preparación' ? "border-primary/30 bg-primary/5" : "border-transparent bg-muted/20"
                            )}>
                                <div className="flex flex-col gap-3 w-full">
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-3xl text-primary leading-none shrink-0">{item.quantity}</span>
                                        <span className="font-bold text-lg leading-tight uppercase tracking-tight">{item.name}</span>
                                    </div>
                                    
                                    {item.notes && (
                                        <div className="p-3 bg-amber-100 dark:bg-amber-900/40 border-l-4 border-amber-500 rounded-xl text-base font-black text-amber-950 dark:text-amber-100 shadow-md">
                                            <span className="text-[10px] block opacity-50 mb-1 uppercase tracking-tighter">Instrucciones:</span>
                                            {item.notes}
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        {item.status === 'Pendiente' ? (
                                            <Button 
                                                className="w-full h-12 font-black text-xs uppercase tracking-widest shadow-lg"
                                                onClick={() => handleUpdateItemStatus(item.id, 'En preparación')}
                                                disabled={isUpdating}
                                            >
                                                Empezar Preparación
                                            </Button>
                                        ) : (
                                            <Button 
                                                variant="outline"
                                                className="w-full h-12 font-black text-xs uppercase tracking-widest bg-green-500 hover:bg-green-600 text-white border-none shadow-lg"
                                                onClick={() => handleUpdateItemStatus(item.id, 'Entregado')}
                                                disabled={isUpdating}
                                            >
                                                <CheckCircle className="mr-2 h-4 w-4" /> Marcar como Listo
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

export default function OrderQueuePage({ type }: OrderQueuePageProps) {
    const { firestore } = useFirebase();
    const lastOrderCount = useRef(0);

    const areaStatusField = type === 'Kitchen' ? 'kitchenStatus' : 'barStatus';

    const ordersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'orders'),
            where(areaStatusField, 'in', ['Pendiente', 'En preparación']),
            orderBy('createdAt', 'asc')
        );
    }, [firestore, areaStatusField]);

    const { data: allOrders, isLoading } = useCollection<Order>(ordersQuery);

    const filteredOrders = (allOrders || []).map(order => {
        const relevantItems = (order.items || []).filter(item => {
            // Filter by category
            const matchesCategory = (type === 'Kitchen' && item.category === 'Food') || 
                                  (type === 'Bar' && item.category === 'Beverage');
                                  
            // IMPORTANT: Only show items that are not 'Entregado' in the queue
            return matchesCategory && item.status !== 'Entregado';
        });
        return { order, items: relevantItems };
    }).filter(o => o.items.length > 0);

    useEffect(() => {
        if (filteredOrders.length > lastOrderCount.current) {
            playNotificationSound('bell');
        }
        lastOrderCount.current = filteredOrders.length;
    }, [filteredOrders.length]);

    if (isLoading) {
        return <div className="flex h-[80vh] items-center justify-center font-black text-2xl uppercase">Cargando Pedidos...</div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-muted/20">
            {/* Header Operativo */}
            <div className="bg-background border-b p-4 flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "p-3 rounded-2xl",
                        type === 'Kitchen' ? "bg-orange-500 text-white" : "bg-blue-500 text-white"
                    )}>
                        {type === 'Kitchen' ? <Flame className="h-6 w-6" /> : <GlassWater className="h-6 w-6" />}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">
                            Cola de {type === 'Kitchen' ? 'Cocina' : 'Bar'}
                        </h1>
                        <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2 mt-1">
                            <span className="flex h-2 w-2 rounded-full bg-green-500" />
                            Sistema en Línea - {filteredOrders.length} Pendientes
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="h-10 px-4 text-sm font-black bg-background border-2 tabular-nums shadow-sm">
                        {new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                    </Badge>
                </div>
            </div>

            {/* Grid de KDS */}
            <ScrollArea className="flex-1 p-4 lg:p-6">
                {filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground/30">
                        <ChefHat className="h-24 w-24 mb-4" />
                        <p className="text-2xl font-black uppercase tracking-[0.2em]">Sin pedidos pendientes</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {filteredOrders.map(({ order, items }) => (
                            <OrderCard key={order.id} order={order} type={type} items={items} />
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}