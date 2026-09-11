'use client';

import React, { useState, useTransition, type ReactNode, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Room, Stay, RoomType, SinpeAccount } from '@/types';
import { reassignRoom } from '@/lib/actions/room.actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ArrowLeftRight, RefreshCw, AlertTriangle, Clock, Wallet, Smartphone, CreditCard, CheckCircle, ArrowRight, DollarSign } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ReassignRoomDialogProps {
    children: ReactNode;
    stay: Stay | null | undefined;
    room: Room;
}

export default function ReassignRoomDialog({ children, stay, room }: ReassignRoomDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const router = useRouter();
    
    const [targetRoomId, setTargetRoomId] = useState<string>('');
    const [selectedNewPlanName, setSelectedNewPlanName] = useState<string>('');
    const [payDifferenceNow, setPayDifferenceNow] = useState<boolean>(true);
    const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Sinpe Movil' | 'Tarjeta'>('Efectivo');
    const [paymentConfirmed, setPaymentConfirmed] = useState<boolean>(false);
    const [voucherNumber, setVoucherNumber] = useState<string>('');
    const [cashTendered, setCashTendered] = useState<string>('');

    // Query for rooms in 'Available' state
    const roomsQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, "rooms"), where('status', '==', 'Available')) : null,
        [firestore]
    );
    const { data: availableRooms, isLoading: isLoadingRooms } = useCollection<Room>(roomsQuery);

    // Query for room types
    const roomTypesQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'roomTypes')) : null,
        [firestore]
    );
    const { data: roomTypes } = useCollection<RoomType>(roomTypesQuery);

    // Query active SINPE accounts
    const sinpeAccountsQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, "sinpeAccounts"), where('isActive', '==', true), orderBy('createdAt', 'asc')) : null,
        [firestore]
    );
    const { data: activeSinpeAccounts, isLoading: isLoadingSinpe } = useCollection<SinpeAccount>(sinpeAccountsQuery);

    // Filter and sort available rooms
    const sortedRooms = useMemo(() => {
        if (!availableRooms) return [];
        return [...availableRooms]
            .filter(r => r.id !== room.id)
            .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    }, [availableRooms, room.id]);

    const targetRoom = useMemo(() => {
        if (!targetRoomId || !sortedRooms) return null;
        return sortedRooms.find(r => r.id === targetRoomId) || null;
    }, [targetRoomId, sortedRooms]);

    const targetRoomType = useMemo(() => {
        if (!targetRoom || !roomTypes) return null;
        return roomTypes.find(rt => rt.id === targetRoom.roomTypeId) || null;
    }, [targetRoom, roomTypes]);

    const availableTargetPlans = useMemo(() => {
        if (!targetRoomType?.pricePlans) return [];
        return [...targetRoomType.pricePlans].sort((a, b) => a.price - b.price);
    }, [targetRoomType]);

    // Auto-select equivalent plan or first available plan when target room changes
    useEffect(() => {
        if (availableTargetPlans.length > 0) {
            const matchingPlan = availableTargetPlans.find(p => p.name === stay?.pricePlanName);
            if (matchingPlan) {
                setSelectedNewPlanName(matchingPlan.name);
            } else {
                setSelectedNewPlanName(availableTargetPlans[0].name);
            }
        } else {
            setSelectedNewPlanName('');
        }
    }, [targetRoomId, availableTargetPlans, stay?.pricePlanName]);

    const selectedNewPlan = useMemo(() => {
        if (!selectedNewPlanName || !availableTargetPlans.length) return null;
        return availableTargetPlans.find(p => p.name === selectedNewPlanName) || null;
    }, [selectedNewPlanName, availableTargetPlans]);

    const originalPlanPrice = stay?.pricePlanAmount || 0;
    const newPlanPrice = selectedNewPlan ? selectedNewPlan.price : originalPlanPrice;
    const priceDifference = newPlanPrice - originalPlanPrice;

    const extraFee = (paymentMethod === 'Sinpe Movil' || paymentMethod === 'Tarjeta') && priceDifference > 0 ? 2000 : 0;
    const totalDifferenceToPay = priceDifference > 0 ? priceDifference + extraFee : 0;

    const targetSinpeAccount = useMemo(() => {
        if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts || totalDifferenceToPay <= 0) return null;
        for (const account of activeSinpeAccounts) {
            const limit = account.limitAmount || Infinity;
            if ((account.balance + totalDifferenceToPay) <= limit) return account;
        }
        return null;
    }, [paymentMethod, activeSinpeAccounts, totalDifferenceToPay]);

    const numericCashTendered = useMemo(() => {
        return Number(cashTendered.replace(/\D/g, ''));
    }, [cashTendered]);

    const handleCashTenderedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        if (rawValue === '') {
            setCashTendered('');
        } else {
            setCashTendered(new Intl.NumberFormat('en-US').format(Number(rawValue)));
        }
    };

    // Reset state when opening/closing
    useEffect(() => {
        if (!open) {
            setTargetRoomId('');
            setSelectedNewPlanName('');
            setPayDifferenceNow(true);
            setPaymentMethod('Efectivo');
            setPaymentConfirmed(false);
            setVoucherNumber('');
            setCashTendered('');
        }
    }, [open]);

    const handleReassign = () => {
        if (!stay || !targetRoomId) return;

        if (priceDifference > 0 && payDifferenceNow) {
            if (paymentMethod === 'Efectivo') {
                if (!cashTendered || numericCashTendered <= 0) {
                    toast({ title: 'Monto requerido', description: 'Ingrese el monto recibido en efectivo.', variant: 'destructive' });
                    return;
                }
                if (numericCashTendered < totalDifferenceToPay) {
                    toast({ title: 'Monto insuficiente', description: `El monto recibido debe ser al menos ${formatCurrency(totalDifferenceToPay)}.`, variant: 'destructive' });
                    return;
                }
            } else if (paymentMethod === 'Sinpe Movil') {
                if (!paymentConfirmed) {
                    toast({ title: 'Confirmación requerida', description: 'Debe confirmar que el pago por SINPE fue recibido.', variant: 'destructive' });
                    return;
                }
            } else if (paymentMethod === 'Tarjeta') {
                if (!voucherNumber.trim()) {
                    toast({ title: 'Voucher requerido', description: 'Ingrese el número de voucher de la tarjeta.', variant: 'destructive' });
                    return;
                }
            }
        }

        startTransition(async () => {
            const result = await reassignRoom(stay.id, room.id, targetRoomId, {
                newPlanName: selectedNewPlanName || undefined,
                payDifferenceNow: priceDifference > 0 ? payDifferenceNow : false,
                paymentMethod: priceDifference > 0 && payDifferenceNow ? paymentMethod : undefined,
                paymentConfirmed: priceDifference > 0 && payDifferenceNow ? paymentConfirmed : undefined,
                voucherNumber: priceDifference > 0 && payDifferenceNow ? voucherNumber : undefined,
                paymentAmount: priceDifference > 0 && payDifferenceNow ? (paymentMethod === 'Efectivo' ? numericCashTendered : totalDifferenceToPay) : undefined,
            });

            if (result.error) {
                toast({
                    title: 'Error de reasignación',
                    description: result.error,
                    variant: 'destructive',
                });
            } else {
                toast({
                    title: '¡Traslado completado!',
                    description: `Huésped trasladado a la Habitación ${targetRoom?.number || ''} exitosamente.`,
                });
                setOpen(false);
                router.push(`/rooms/${targetRoomId}`);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-lg p-0 border-none bg-slate-950/80 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.6)] rounded-[2.5rem] max-h-[90vh] overflow-y-auto scrollbar-hide">
                <div className="relative overflow-hidden p-6 sm:p-8">
                    {/* Decorative background glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary rounded-full blur-[80px] opacity-15 pointer-events-none" />

                    <DialogHeader className="mb-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 shadow-inner text-primary">
                                <ArrowLeftRight className="h-6 w-6" />
                            </div>
                            <DialogTitle className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter text-white">
                                Reasignar Habitación
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-slate-400 font-medium text-xs sm:text-sm">
                            Traslada al huésped a otra habitación disponible y ajusta la tarifa si corresponde.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Selector de Habitación de Destino */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                Habitación de Destino
                            </label>
                            {isLoadingRooms ? (
                                <div className="h-12 w-full bg-white/5 border border-white/5 rounded-2xl animate-pulse flex items-center px-4">
                                    <span className="text-xs text-slate-500">Cargando habitaciones disponibles...</span>
                                </div>
                            ) : sortedRooms.length === 0 ? (
                                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3">
                                    <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
                                    <p className="text-xs text-rose-400 font-medium">
                                        No hay otras habitaciones disponibles en este momento.
                                    </p>
                                </div>
                            ) : (
                                <Select value={targetRoomId} onValueChange={setTargetRoomId}>
                                    <SelectTrigger className="w-full h-12 bg-white/5 border-white/10 text-white rounded-2xl focus:ring-primary font-bold">
                                        <SelectValue placeholder="Seleccione una habitación..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl">
                                        {sortedRooms.map((r) => (
                                            <SelectItem key={r.id} value={r.id} className="focus:bg-primary focus:text-white rounded-lg cursor-pointer py-2.5 font-bold">
                                                Habitación {r.number} — {r.roomTypeName || r.type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Selector de Plan para la Nueva Habitación */}
                        {targetRoom && availableTargetPlans.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Plan en Nueva Habitación ({targetRoom.number})
                                </label>
                                <Select value={selectedNewPlanName} onValueChange={setSelectedNewPlanName}>
                                    <SelectTrigger className="w-full h-12 bg-white/5 border-white/10 text-white rounded-2xl focus:ring-primary font-bold">
                                        <SelectValue placeholder="Seleccione un plan de estancia..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl">
                                        {availableTargetPlans.map((p) => (
                                            <SelectItem key={p.name} value={p.name} className="focus:bg-primary focus:text-white rounded-lg cursor-pointer py-2.5 font-bold">
                                                {p.name} — {formatCurrency(p.price)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Resumen Comparativo de Tarifas y Diferencia */}
                        {targetRoom && stay && (
                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                                    <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
                                        <div className="space-y-0.5">
                                            <span className="text-[9px] uppercase font-black tracking-widest text-slate-500">Plan Actual (Hab. {room.number})</span>
                                            <p className="font-bold text-slate-300">{stay.pricePlanName || 'Plan Inicial'} ({formatCurrency(originalPlanPrice)})</p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-slate-500 mx-2 shrink-0" />
                                        <div className="text-right space-y-0.5">
                                            <span className="text-[9px] uppercase font-black tracking-widest text-primary">Nuevo Plan (Hab. {targetRoom.number})</span>
                                            <p className="font-bold text-white">{selectedNewPlanName || 'Plan Destino'} ({formatCurrency(newPlanPrice)})</p>
                                        </div>
                                    </div>

                                    {/* Estado del Balance / Diferencia */}
                                    {priceDifference > 0 ? (
                                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <DollarSign className="h-5 w-5 text-amber-400" />
                                                <div>
                                                    <p className="text-xs font-black uppercase text-amber-400 tracking-wider">Excedente a Pagar</p>
                                                    <p className="text-[10px] text-amber-200/70 font-medium">La nueva habitación tiene un costo mayor</p>
                                                </div>
                                            </div>
                                            <span className="text-base font-black text-amber-300 font-mono">
                                                +{formatCurrency(priceDifference)}
                                            </span>
                                        </div>
                                    ) : priceDifference < 0 ? (
                                        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <CheckCircle className="h-5 w-5 text-emerald-400" />
                                                <div>
                                                    <p className="text-xs font-black uppercase text-emerald-400 tracking-wider">Diferencia a Favor del Huésped</p>
                                                    <p className="text-[10px] text-emerald-200/70 font-medium">Quedará como crédito para consumos o ajuste al check-out</p>
                                                </div>
                                            </div>
                                            <span className="text-base font-black text-emerald-400 font-mono">
                                                -{formatCurrency(Math.abs(priceDifference))}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-xl bg-slate-900 border border-white/5 text-center">
                                            <span className="text-xs font-bold text-slate-300">
                                                Misma tarifa — Sin diferencia de cobro (₡0.00)
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Formulario de Cobro si hay Excedente */}
                                {priceDifference > 0 && (
                                    <div className="p-5 rounded-2xl border border-primary/20 bg-primary/[0.03] space-y-4 shadow-xl">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <label className="text-xs font-black uppercase text-white tracking-wider">¿Cobrar excedente ahora?</label>
                                                <p className="text-[10px] text-slate-400">Si se desactiva, se cargará a la cuenta de salida.</p>
                                            </div>
                                            <Switch
                                                checked={payDifferenceNow}
                                                onCheckedChange={setPayDifferenceNow}
                                                className="data-[state=checked]:bg-primary"
                                            />
                                        </div>

                                        {payDifferenceNow && (
                                            <div className="space-y-4 pt-3 border-t border-white/5">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Método de Pago</label>
                                                    <Select value={paymentMethod} onValueChange={(val: any) => setPaymentMethod(val)}>
                                                        <SelectTrigger className="w-full h-12 bg-white/5 border-white/10 rounded-xl font-bold text-white">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-slate-900 border-white/10 rounded-xl text-white">
                                                            <SelectItem value="Efectivo" className="py-2.5 font-bold">Efectivo</SelectItem>
                                                            <SelectItem value="Sinpe Movil" className="py-2.5 font-bold">Sinpe Móvil</SelectItem>
                                                            <SelectItem value="Tarjeta" className="py-2.5 font-bold">Tarjeta</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Efectivo */}
                                                {paymentMethod === 'Efectivo' && (
                                                    <div className="space-y-3">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Monto Recibido</label>
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            placeholder="₡ 0.00"
                                                            value={cashTendered}
                                                            onChange={handleCashTenderedChange}
                                                            className="h-12 bg-white/5 border-white/10 rounded-xl text-right text-lg font-black text-white"
                                                        />
                                                        {cashTendered && numericCashTendered >= totalDifferenceToPay && (
                                                            <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Vuelto</span>
                                                                <span className="text-base font-black text-emerald-400">
                                                                    {formatCurrency(numericCashTendered - totalDifferenceToPay)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* SINPE Móvil */}
                                                {paymentMethod === 'Sinpe Movil' && (
                                                    <div className="space-y-3">
                                                        {targetSinpeAccount ? (
                                                            <div className="p-4 bg-slate-950/60 rounded-xl text-center border border-primary/20 space-y-1">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Transferir {formatCurrency(totalDifferenceToPay)} a:</p>
                                                                <p className="text-xl font-black font-mono text-white">{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                                <p className="text-[10px] font-bold text-slate-400">{targetSinpeAccount.accountHolder}</p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded-xl">Sin cuenta SINPE con límite disponible.</p>
                                                        )}
                                                        <label className="flex items-center gap-3 p-3 bg-slate-950/40 rounded-xl border border-white/5 cursor-pointer">
                                                            <Checkbox
                                                                checked={paymentConfirmed}
                                                                onCheckedChange={(checked) => setPaymentConfirmed(!!checked)}
                                                                className="data-[state=checked]:bg-primary"
                                                            />
                                                            <span className="text-xs font-bold text-slate-200">Confirmar recepción del pago por SINPE</span>
                                                        </label>
                                                    </div>
                                                )}

                                                {/* Tarjeta */}
                                                {paymentMethod === 'Tarjeta' && (
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">N° de Voucher / Referencia</label>
                                                        <Input
                                                            type="text"
                                                            placeholder="VOUCHER #"
                                                            value={voucherNumber}
                                                            onChange={(e) => setVoucherNumber(e.target.value)}
                                                            className="h-12 bg-white/5 border-white/10 rounded-xl font-mono uppercase text-center text-white"
                                                        />
                                                    </div>
                                                )}

                                                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-xl border border-primary/20">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Total a Cobrar</span>
                                                    <span className="text-lg font-black text-white font-mono">{formatCurrency(totalDifferenceToPay)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <DialogFooter className="pt-4 gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                className="rounded-2xl h-12 px-6 border-white/10 text-white hover:bg-white/5"
                                disabled={isPending}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleReassign}
                                className="rounded-2xl h-12 px-6 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                                disabled={!targetRoomId || isPending || !stay}
                            >
                                {isPending ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Reasignando...
                                    </>
                                ) : (
                                    priceDifference > 0 && payDifferenceNow ? 'Cobrar y Reasignar' : 'Confirmar Reasignación'
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
