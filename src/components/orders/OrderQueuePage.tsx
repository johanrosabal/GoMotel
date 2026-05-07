'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
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
import { cn, formatCurrency } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertTriangle, History, Info, Trash2 } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';

interface CancellationAudit {
    id: string;
    orderId: string;
    serviceId: string;
    serviceName: string;
    quantity: number;
    previousStatus: string;
    reason: string;
    notes?: string;
    locationLabel: string;
    area: 'Kitchen' | 'Bar' | 'Other';
    timestamp: any;
}

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
                                                disabled={isUpdating} data-testid="orderqueuepage-action-start-button"
                                            >
                                                Empezar Preparación
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                className="w-full h-12 font-black text-xs uppercase tracking-widest bg-green-500 hover:bg-green-600 text-white border-none shadow-lg"
                                                onClick={() => handleUpdateItemStatus(item.id, 'Listo')}
                                                disabled={isUpdating} data-testid="orderqueuepage-action-finish-button"
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

            // IMPORTANT: Only show items that are not 'Entregado' or 'Cancelado' in the queue
            return matchesCategory && item.status !== 'Entregado' && item.status !== 'Cancelado';
        });
        return { order, items: relevantItems };
    }).filter(o => o.items.length > 0);

    useEffect(() => {
        if (filteredOrders.length > lastOrderCount.current) {
            playNotificationSound('bell');
        }
        lastOrderCount.current = filteredOrders.length;
    }, [filteredOrders.length]);

    const auditQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'cancellationAudit'),
            where('area', '==', type),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
    }, [firestore, type]);

    const { data: cancelledAudits, isLoading: loadingAudit } = useCollection<CancellationAudit>(auditQuery);

    if (isLoading) {
        return <div className="flex h-[80vh] items-center justify-center font-black text-2xl uppercase">Cargando Pedidos...</div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-muted/20" data-testid="orderqueuepage-main-div">
            {/* Header Operativo */}
            <div className="bg-background border-b p-4 flex flex-col sm:flex-row items-center justify-between shrink-0 shadow-sm gap-4">
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

                <Tabs defaultValue="active" className="w-full sm:w-auto">
                    <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/50 p-1 rounded-xl">
                        <TabsTrigger value="active" className="rounded-lg font-black uppercase text-[10px] tracking-widest gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <ChefHat className="h-4 w-4" />
                            Cola Activa
                        </TabsTrigger>
                        <TabsTrigger value="cancelled" className="rounded-lg font-black uppercase text-[10px] tracking-widest gap-2 data-[state=active]:bg-destructive data-[state=active]:text-white">
                            <History className="h-4 w-4" />
                            Cancelados
                            {cancelledAudits && cancelledAudits.length > 0 && (
                                <Badge className="ml-1 bg-white text-destructive h-5 min-w-[20px] p-0 flex justify-center">{cancelledAudits.length}</Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="active" className="fixed inset-0 top-[140px] overflow-hidden">
                        <ScrollArea className="h-full p-4 lg:p-6">
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
                    </TabsContent>

                    <TabsContent value="cancelled" className="fixed inset-0 top-[140px] overflow-hidden">
                        <ScrollArea className="h-full p-4 lg:p-6">
                            {!cancelledAudits || cancelledAudits.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground/20">
                                    <Trash2 className="h-24 w-24 mb-4" />
                                    <p className="text-2xl font-black uppercase tracking-[0.2em]">No hay registros de cancelados</p>
                                </div>
                            ) : (
                                <div className="max-w-4xl mx-auto space-y-4">
                                    <div className="bg-destructive/10 border-2 border-destructive/20 p-4 rounded-2xl flex items-center gap-4 mb-6">
                                        <AlertTriangle className="h-8 w-8 text-destructive animate-pulse" />
                                        <div>
                                            <h2 className="font-black uppercase text-destructive tracking-tight">Registro de Pérdidas y Cancelaciones</h2>
                                            <p className="text-xs font-bold opacity-70 uppercase">Estos productos fueron cancelados mientras estaban en preparación o listos.</p>
                                        </div>
                                    </div>
                                    {cancelledAudits.map((audit) => (
                                        <Card key={audit.id} className="border-2 border-border/50 hover:border-destructive/30 transition-all shadow-sm overflow-hidden group">
                                            <div className="flex flex-col sm:flex-row">
                                                <div className="bg-muted/30 p-4 sm:w-48 flex flex-col justify-center items-center text-center border-b sm:border-b-0 sm:border-r border-border/50">
                                                    <span className="text-3xl font-black text-primary leading-none">{audit.quantity}</span>
                                                    <span className="text-[10px] font-bold uppercase text-muted-foreground mt-1">Unidades</span>
                                                    <Badge variant="outline" className="mt-2 bg-background font-black uppercase text-[9px] border-destructive/30 text-destructive">
                                                        {audit.previousStatus}
                                                    </Badge>
                                                </div>
                                                <div className="flex-1 p-4">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="text-lg font-black uppercase tracking-tight leading-none group-hover:text-destructive transition-colors">
                                                            {audit.serviceName}
                                                        </h3>
                                                        <span className="text-[10px] font-black tabular-nums opacity-40">
                                                            {audit.timestamp?.toDate().toLocaleString('es-CR')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Badge className="bg-muted text-muted-foreground border-none font-black text-[9px] uppercase tracking-wider">
                                                            Mesa: {audit.locationLabel}
                                                        </Badge>
                                                        <span className="text-[10px] opacity-40 font-bold uppercase tracking-widest flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {audit.timestamp && formatDistance(audit.timestamp.toDate(), new Date(), { locale: es, addSuffix: true })}
                                                        </span>
                                                    </div>
                                                    <div className="bg-destructive/5 border border-destructive/10 p-3 rounded-xl">
                                                        <p className="text-[10px] font-black text-destructive uppercase mb-1 flex items-center gap-1">
                                                            <Info className="h-3 w-3" /> Motivo de Cancelación
                                                        </p>
                                                        <p className="text-sm font-bold italic leading-tight">
                                                            "{audit.reason}"
                                                            {audit.notes && <span className="block not-italic opacity-60 mt-1">— {audit.notes}</span>}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>

                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="h-10 px-4 text-sm font-black bg-background border-2 tabular-nums shadow-sm">
                        {new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                    </Badge>
                </div>
            </div>
        </div>
    );
}