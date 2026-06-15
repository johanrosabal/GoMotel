
'use client';

import { useState, useTransition, useEffect, useMemo, useCallback } from 'react';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy as fbOrderBy, addDoc, Timestamp } from 'firebase/firestore';
import type { Room, Client, RoomType, SinpeAccount } from '@/types';
import DateTimePicker from './DateTimePicker';
import { createReservation } from '@/lib/actions/reservation.actions';
import { getSystemSettings } from '@/lib/actions/system.actions';
import { addMinutes, addHours, addDays, addWeeks, addMonths, format, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, Star, Clock, CheckCircle, User, BedDouble, CalendarDays, Wallet, ChevronRight, ChevronLeft, Skull, AlertCircle, AlertTriangle, Ban, Search, Loader2, Smartphone, CreditCard } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '../ui/separator';
import { motion } from 'framer-motion';
import InvoiceSuccessDialog from './InvoiceSuccessDialog';
import ReservationSuccessDialog from './ReservationSuccessDialog';
import { useUserProfile } from '@/hooks/use-user-profile';
import AddClientDialog from '@/components/clients/AddClientDialog';



interface CreateReservationDialogProps {
    children: React.ReactNode;
    initialRoomId?: string;
    isWalkIn?: boolean;
}

const reservationSchema = z.object({
    guestName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
    roomId: z.string({ required_error: 'Debe seleccionar una habitación.' }),
    pricePlanName: z.string({ required_error: 'Debe seleccionar un plan de estancia.' }),
    checkInDate: z.date(),
    guestId: z.string().nullable().optional(),
    checkInNow: z.boolean().default(false),
    isOpenAccount: z.boolean().default(false),
    paymentMethod: z.enum(['Efectivo', 'Sinpe Movil', 'Tarjeta']).nullable().optional(),
    paymentConfirmed: z.boolean().default(false),
    voucherNumber: z.string().nullable().optional(),
    remoteControlDelivered: z.boolean().default(false),
    guestIdCard: z.string().optional(),
}).refine(data => {
    if (data.checkInNow) {
        return data.isOpenAccount || !!data.paymentMethod;
    }
    return true;
}, {
    message: "Debe seleccionar un método de pago.",
    path: ["paymentMethod"],
}).refine(data => {
    if (data.checkInNow && !data.isOpenAccount && data.paymentMethod === 'Sinpe Movil') {
        return !!data.paymentConfirmed;
    }
    return true;
}, {
    message: 'Debe confirmar que el pago fue recibido.',
    path: ['paymentConfirmed'],
}).refine(data => {
    if (data.checkInNow && !data.isOpenAccount && data.paymentMethod === 'Tarjeta') {
        return data.voucherNumber && data.voucherNumber.trim() !== '';
    }
    return true;
}, {
    message: "El número de voucher es requerido.",
    path: ["voucherNumber"],
});


export default function CreateReservationDialog({ children, initialRoomId, isWalkIn = false }: CreateReservationDialogProps) {
    const [open, setOpen] = useState(false);
    const [stableNow, setStableNow] = useState(new Date());

    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const { firestore, user } = useFirebase();
    const { userProfile } = useUserProfile();

    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [showAddClientModal, setShowAddClientModal] = useState(false);
    const [prefilledClient, setPrefilledClient] = useState<any | null>(null);
    const [cashTendered, setCashTendered] = useState('');
    const [isForeigner, setIsForeigner] = useState(false);
    const [showAddForeignerModal, setShowAddForeignerModal] = useState(false);
    const [foreignerId, setForeignerId] = useState('');
    const [foreignerName, setForeignerName] = useState('');
    const [foreignerLastName, setForeignerLastName] = useState('');
    const [foreignerNotes, setForeignerNotes] = useState('');
    const [foreignerIsNational, setForeignerIsNational] = useState(false);
    const [guestCount, setGuestCount] = useState(1);

    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [reservationSuccessModalOpen, setReservationSuccessModalOpen] = useState(false);
    const [invoiceId, setInvoiceId] = useState<string | null>(null);
    const [reservationId, setReservationId] = useState<string | null>(null);

    const roomsQuery = useMemoFirebase(() => {
        if (typeof window === 'undefined') return null;
        if (!firestore) return null;
        return query(collection(firestore, 'rooms'), fbOrderBy('number'));
    }, [firestore]);
    const { data: rooms, isLoading: isLoadingRooms } = useCollection<Room>(roomsQuery);

    const clientsQuery = useMemoFirebase(() => {
        if (typeof window === 'undefined') return null;
        if (!firestore) return null;
        return query(collection(firestore, "clients"));
    }, [firestore]);
    const { data: clients, isLoading: isLoadingClients } = useCollection<Client>(clientsQuery);

    const roomTypesQuery = useMemoFirebase(() => {
        if (typeof window === 'undefined') return null;
        if (!firestore) return null;
        return query(collection(firestore, 'roomTypes'));
    }, [firestore]);
    const { data: roomTypes, isLoading: isLoadingRoomTypes } = useCollection<RoomType>(roomTypesQuery);

    const sinpeAccountsQuery = useMemoFirebase(() => {
        if (typeof window === 'undefined') return null;
        if (!firestore) return null;
        return query(collection(firestore, "sinpeAccounts"), where('isActive', '==', true), fbOrderBy('createdAt', 'asc'));
    }, [firestore]);
    const { data: activeSinpeAccounts, isLoading: isLoadingSinpe } = useCollection<SinpeAccount>(sinpeAccountsQuery);

    const defaultValues = useMemo(() => ({
        guestIdCard: '',
        guestName: '',
        guestId: null,
        roomId: isWalkIn ? initialRoomId : undefined,
        pricePlanName: undefined,
        checkInNow: isWalkIn,
        checkInDate: new Date(),
        isOpenAccount: false,
        paymentMethod: null,
        paymentConfirmed: false,
        voucherNumber: null,
        remoteControlDelivered: false,
    }), [isWalkIn, initialRoomId]);

    const resolver = useMemo(() => zodResolver(reservationSchema), []);

    const form = useForm<z.infer<typeof reservationSchema>>({
        resolver,
        defaultValues,
    });

    const guestNameValue = form.watch('guestName');
    const guestIdValue = form.watch('guestId');
    
    const cleanInput = guestNameValue ? guestNameValue.replace(/\D/g, '') : '';
    const looksLikeId = cleanInput.length >= 5 && cleanInput.length <= 9;

    const sortedClients = useMemo(() => {
        if (!clients) return [];
        return [...clients].sort((a, b) => {
            if (a.isVip && !b.isVip) return -1;
            if (!a.isVip && b.isVip) return 1;
            return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        });
    }, [clients]);

    const filteredClients = useMemo(() => {
        if (!guestNameValue) return sortedClients;
        const lowercasedQuery = guestNameValue.toLowerCase();
        return sortedClients.filter(client =>
            `${client.firstName} ${client.lastName}`.toLowerCase().includes(lowercasedQuery)
        );
    }, [guestNameValue, sortedClients]);

    const selectedClient = useMemo(() => {
        if (!guestIdValue || !clients) return null;
        return clients.find(c => c.id === guestIdValue);
    }, [guestIdValue, clients]);

    const handleIdCardChange = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (value: string) => void) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const maxLength = 9;
        const value = rawValue.slice(0, maxLength);

        let maskedValue = '';
        if (value.length > 5) {
            maskedValue = `${value.slice(0, 1)}-${value.slice(1, 5)}-${value.slice(5)}`;
        } else if (value.length > 1) {
            maskedValue = `${value.slice(0, 1)}-${value.slice(1)}`;
        } else {
            maskedValue = value;
        }

        fieldOnChange(maskedValue);
    };

    const handleSaveForeigner = async () => {
        if (!foreignerId || !foreignerName || !foreignerLastName) {
            toast({ title: 'Campos requeridos', description: 'Por favor complete todos los campos.', variant: 'destructive' });
            return;
        }

        try {
            const clientData = {
                firstName: foreignerName,
                lastName: foreignerLastName,
                secondLastName: '',
                idCard: foreignerId,
                isValidated: false,
                createdAt: Timestamp.now(),
                visitCount: 0,
                isVip: false,
                isBlacklisted: false,
                isForeigner: !foreignerIsNational,
                notes: foreignerNotes,
            };

            const docRef = await addDoc(collection(firestore!, 'clients'), clientData);

            form.setValue('guestName', `${clientData.firstName} ${clientData.lastName}`);
            form.setValue('guestId', docRef.id);
            setShowSuggestions(false);
            setShowAddForeignerModal(false);

            setForeignerId('');
            setForeignerName('');
            setForeignerLastName('');
            setForeignerNotes('');
            setForeignerIsNational(false);

            toast({ title: 'Cliente registrado', description: `Se ha registrado a ${clientData.firstName} exitosamente.` });
        } catch (error) {
            console.error('Error saving foreigner:', error);
            toast({ title: 'Error', description: 'No se pudo registrar el cliente.', variant: 'destructive' });
        }
    };

    const handleVerifyClient = async () => {
        const guestIdCardValue = form.getValues('guestIdCard') || '';
        const cleanId = guestIdCardValue.replace(/\D/g, '');
        if (cleanId.length < 5) return;

        const toTitleCase = (str: string) => str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
        const formatIdCard = (value: string) => {
            if (value.length > 5) return `${value.slice(0, 1)}-${value.slice(1, 5)}-${value.slice(5)}`;
            if (value.length > 1) return `${value.slice(0, 1)}-${value.slice(1)}`;
            return value;
        };

        // 1. Check local DB
        const existingClient = clients?.find(c => c.idCard.replace(/\D/g, '') === cleanId);
        if (existingClient) {
            form.setValue('guestName', `${existingClient.firstName} ${existingClient.lastName}`);
            form.setValue('guestId', existingClient.id);
            setShowSuggestions(false);
            toast({ title: 'Cliente encontrado', description: `${existingClient.firstName} ${existingClient.lastName} seleccionado.` });
            return;
        }

        // Si no se encuentra en Firebase, en lugar de llamar a la API externa, forzamos registro manual
        toast({ title: 'Cliente no encontrado', description: 'Por favor, ingrese los datos manualmente.', variant: 'default' });
        setVerificationError('No se encontró información para esta cédula en la base de datos.');
        setForeignerId(formatIdCard(cleanId));
        setForeignerIsNational(true);
        setShowAddForeignerModal(true);
        setIsVerifying(false);
    };


    const selectedRoomId = form.watch('roomId');
    const selectedPlanName = form.watch('pricePlanName');
    const checkInDateValue = form.watch('checkInDate');
    const checkInNow = form.watch('checkInNow');
    const isOpenAccount = form.watch('isOpenAccount');
    const paymentMethod = form.watch('paymentMethod');

    const selectedRoom = useMemo(() => rooms?.find(r => r.id === selectedRoomId), [rooms, selectedRoomId]);

    // FILTRADO DE HABITACIONES: Mostrar solo disponibles
    const availableRooms = useMemo(() => {
        if (!rooms) return [];
        // Filtramos para mostrar solo disponibles, a menos que sea la habitación inicial seleccionada (para Walk-ins)
        return rooms.filter(room => room.status === 'Available' || room.id === initialRoomId);
    }, [rooms, initialRoomId]);

    const availablePlans = useMemo(() => {
        if (!selectedRoom || !roomTypes) return [];
        const roomType = roomTypes.find(rt => rt.id === selectedRoom.roomTypeId);
        return [...(roomType?.pricePlans || [])].sort((a, b) => {
            if (a.price !== b.price) return a.price - b.price;
            return a.name.localeCompare(b.name);
        });
    }, [selectedRoom, roomTypes]);

    const selectedPlan = useMemo(() => {
        console.log('selectedPlanName:', selectedPlanName);
        console.log('availablePlans:', availablePlans);
        if (!selectedPlanName || !availablePlans.length) return null;
        const found = availablePlans.find(p => p.name === selectedPlanName);
        console.log('found plan:', found);
        return found;
    }, [selectedPlanName, availablePlans]);

    const targetSinpeAccount = useMemo(() => {
        if (paymentMethod !== 'Sinpe Movil' || !activeSinpeAccounts || !selectedPlan) return null;
        const paymentAmount = selectedPlan.price;
        for (const account of activeSinpeAccounts) {
            const limit = account.limitAmount || Infinity;
            if ((account.balance + paymentAmount) <= limit) return account;
        }
        return null;
    }, [paymentMethod, activeSinpeAccounts, selectedPlan]);

    const resetForm = useCallback(() => {
        form.reset({
            guestName: '',
            guestId: null,
            roomId: isWalkIn ? initialRoomId : undefined,
            pricePlanName: undefined,
            checkInNow: isWalkIn,
            checkInDate: new Date(),
            isOpenAccount: false,
            paymentMethod: null,
            paymentConfirmed: false,
            voucherNumber: null,
            remoteControlDelivered: false,
        });
        setShowSuggestions(false);
        setCashTendered('');
        setStableNow(new Date());
        setGuestCount(1);
    }, [form, isWalkIn, initialRoomId]);

    // Removed useEffect for resetForm to prevent loops




    const calculatedCheckOut = useMemo(() => {
        const baseDate = checkInNow ? stableNow : checkInDateValue;
        if (!baseDate || !selectedPlanName || !availablePlans.length) {
            return null;
        }
        const plan = availablePlans.find(p => p.name === selectedPlanName);
        if (plan) {
            let newCheckOutDate = new Date(baseDate);
            const { duration, unit } = plan;
            if (unit === 'Minutes') newCheckOutDate = addMinutes(newCheckOutDate, duration);
            else if (unit === 'Hours') newCheckOutDate = addHours(newCheckOutDate, duration);
            else if (unit === 'Days') newCheckOutDate = addDays(newCheckOutDate, duration);
            else if (unit === 'Weeks') newCheckOutDate = addWeeks(newCheckOutDate, duration);
            else if (unit === 'Months') newCheckOutDate = addMonths(newCheckOutDate, duration);
            return newCheckOutDate;
        }
        return null;
    }, [checkInDateValue, selectedPlanName, JSON.stringify(availablePlans), checkInNow, stableNow]);

    useEffect(() => {
        if (selectedPlan?.unit === 'Months' && form.getValues('paymentMethod') !== 'Efectivo') {
            form.setValue('paymentMethod', 'Efectivo');
            setCashTendered('');
            form.setValue('voucherNumber', null);
            form.setValue('paymentConfirmed', false);
        }
    }, [selectedPlan, form]);

    const handleCashTenderedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        setCashTendered(rawValue === '' ? '' : new Intl.NumberFormat('en-US').format(Number(rawValue)));
    };

    const numericCashTendered = useMemo(() => Number(cashTendered.replace(/\D/g, '')), [cashTendered]);

    const onSubmit = (values: z.infer<typeof reservationSchema>) => {

        if (!calculatedCheckOut) {
            toast({ title: "Error", description: "Fecha de salida no válida.", variant: "destructive" });
            return;
        }

        const finalCheckInDate = values.checkInNow ? new Date() : values.checkInDate;

        const userName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : (user?.displayName || user?.email || 'Sistema');

        startTransition(async () => {
            const result = await createReservation({
                ...values,
                checkInDate: finalCheckInDate,
                checkOutDate: calculatedCheckOut,
                createdBy: userName,
            });
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                // Obtenemos los IDs antes de cerrar por si acaso
                const invId = result.invoiceId;
                const resId = result.reservationId;
                
                setOpen(false);

                if (invId) {
                    setInvoiceId(invId);
                    setTimeout(() => setSuccessModalOpen(true), 200);
                } else if (resId) {
                    setReservationId(resId);
                    setTimeout(() => setReservationSuccessModalOpen(true), 200);
                } else {
                    toast({ title: '¡Éxito!', description: `La operación se ha completado.` });
                }
            }
        });
    };

    const isLoading = isLoadingRooms || isLoadingRoomTypes || isLoadingSinpe;

    return (
        <>
            <Dialog open={open} onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (isOpen) resetForm();
            }}>
                <DialogTrigger asChild>{children}</DialogTrigger>
                <DialogContent className="w-[95vw] max-w-lg sm:max-w-4xl max-h-[92vh] overflow-y-auto scrollbar-hide p-0 border-none bg-background/95 backdrop-blur-xl shadow-2xl">
                    <div className="p-6">
                        <DialogHeader className="bg-primary/5 p-6 -mx-6 -mt-6 mb-6 rounded-t-xl border-b border-primary/10">
                            <DialogTitle className="text-2xl font-black text-primary">{isWalkIn ? 'Registro Rápido' : 'Nueva Reservación'}</DialogTitle>
                            <DialogDescription className="text-muted-foreground">Complete los datos para confirmar la estancia.</DialogDescription>
                        </DialogHeader>



                        <Form {...form}>
                            <form onSubmit={e => e.preventDefault()} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }} id="createreservationdialog-form-main" data-testid="createreservationdialog-main-form">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[320px]">
                                    {/* Columna 1: Huésped y Estancia */}
                                    <div className="space-y-6">
                                        <div className="space-y-6">
                                            <div className="bg-muted/20 p-3 rounded-xl border border-muted mb-4">
                                                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground block mb-2">Origen:</span>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                        <input type="radio" checked={!isForeigner} onChange={() => setIsForeigner(false)} className="form-radio text-primary h-4 w-4" />
                                                        <span className={cn("text-sm font-bold transition-colors", !isForeigner ? "text-white" : "text-muted-foreground group-hover:text-white")}>Nacional</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                        <input type="radio" checked={isForeigner} onChange={() => {
                                                            setIsForeigner(true);
                                                            setShowAddForeignerModal(true);
                                                        }} className="form-radio text-primary h-4 w-4" />
                                                        <span className={cn("text-sm font-bold transition-colors", isForeigner ? "text-white" : "text-muted-foreground group-hover:text-white")}>Extranjero</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {!isForeigner && (
                                                <FormField
                                                    control={form.control}
                                                    name="guestIdCard"
                                                    render={({ field }) => (
                                                        <FormItem className="relative mb-4">
                                                            <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Cédula (Nacional)</FormLabel>
                                                            <FormControl>
                                                                <div className="flex flex-col sm:flex-row gap-2">
                                                                    <Input
                                                                        placeholder="9-9999-9999"
                                                                        {...field}
                                                                        value={field.value || ''}
                                                                        onChange={(e) => handleIdCardChange(e, field.onChange)}
                                                                        className="h-12 text-lg font-medium w-full"
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="secondary"
                                                                        onClick={handleVerifyClient}
                                                                        disabled={isVerifying}
                                                                        className="h-12 shrink-0 font-black uppercase text-xs tracking-widest w-full sm:w-auto"
                                                                    >
                                                                        {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verificar'}
                                                                    </Button>
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}

                                            <FormField
                                                control={form.control}
                                                name="guestName"
                                                render={({ field }) => (
                                                    <FormItem className="relative">
                                                        <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Cliente / Huésped</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="Nombre del cliente..."
                                                                {...field}
                                                                onFocus={() => setShowSuggestions(true)}
                                                                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                                                autoComplete="off"
                                                                className="h-12 text-lg font-medium" id="createreservationdialog-input-nombre-del-cliente" data-testid="createreservationdialog-guest-name-input"
                                                            />
                                                        </FormControl>
                                                        {showSuggestions && (
                                                            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-xl overflow-hidden">
                                                                <ScrollArea className="max-h-56">
                                                                    <div className="p-1">
                                                                        {looksLikeId && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleVerifyClient()}
                                                                                className="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm hover:bg-primary transition-colors group text-primary-foreground"
                                                                            >
                                                                                <Search className="h-4 w-4" />
                                                                                <span>Verificar cédula: <span className="font-mono">{guestNameValue}</span></span>
                                                                            </button>
                                                                        )}
                                                                        {filteredClients.length > 0 ? (
                                                                            filteredClients.map((client) => (
                                                                                <button
                                                                                    type="button"
                                                                                    key={client.id}
                                                                                    onClick={() => {
                                                                                        form.setValue('guestName', `${client.firstName} ${client.lastName}`);
                                                                                        form.setValue('guestId', client.id);
                                                                                        setShowSuggestions(false);
                                                                                    }}
                                                                                    className="flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-sm hover:bg-primary transition-colors group" id="createreservationdialog-button-1" data-testid="createreservationdialog-select-client-button"
                                                                                >
                                                                                    <div className="flex items-center gap-3">
                                                                                        {client.isVip && <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />}
                                                                                        {client.isBlacklisted && <Skull className="h-4 w-4 text-rose-500" />}
                                                                                        <span className={cn("font-semibold transition-colors", client.isBlacklisted ? "text-rose-500" : "text-slate-200 group-hover:text-slate-900")}>
                                                                                            {client.firstName} {client.lastName}
                                                                                        </span>
                                                                                        {client.isBlacklisted && (
                                                                                            <span className="text-[8px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-lg shadow-rose-500/20">
                                                                                                Lista Negra
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <span className="text-[10px] text-muted-foreground group-hover:text-slate-900 font-mono transition-colors">{client.idCard}</span>
                                                                                </button>
                                                                            ))
                                                                        ) : (
                                                                            <div className="p-4 text-center text-xs text-muted-foreground font-medium">
                                                                                Se registrará como nuevo cliente.
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </ScrollArea>
                                                            </div>
                                                        )}
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Blacklist Warning */}
                                            {selectedClient?.isBlacklisted && (
                                                <motion.div 
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="p-5 bg-rose-500/10 border-2 border-rose-500/30 rounded-[2rem] flex items-start gap-4 shadow-xl shadow-rose-500/5 backdrop-blur-xl"
                                                >
                                                    <div className="h-12 w-12 rounded-2xl bg-rose-500 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/50">
                                                        <Ban className="h-6 w-6 text-white" />
                                                    </div>
                                                    <div className="space-y-1.5 flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-xs font-black text-rose-500 uppercase tracking-[0.2em] italic flex items-center gap-2">
                                                                HUÉSPED EN LISTA NEGRA
                                                                <AlertCircle className="h-3 w-3 animate-pulse" />
                                                            </p>
                                                            <span className="text-[10px] font-black bg-rose-500/20 text-rose-500 px-2 py-0.5 rounded-full border border-rose-500/30">BLOQUEADO</span>
                                                        </div>
                                                        <p className="text-xs text-rose-300 font-bold italic leading-relaxed">
                                                            Este cliente ha sido marcado anteriormente por conducta no permitida. <br />
                                                            <span className="text-white bg-rose-500/20 px-2 py-1 rounded inline-block mt-2 border border-rose-500/10 not-italic">Motivo: {selectedClient.blacklistReason || 'Sin motivo especificado'}</span>
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                        <div className="border-t border-muted my-6" />
                                        <div className="space-y-6">
                                            
                                            {isWalkIn && (
                                                <FormField
                                                    control={form.control}
                                                    name="remoteControlDelivered"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border bg-muted/20 p-4 transition-colors">
                                                            <div className="space-y-0.5 cursor-pointer flex-1" onClick={() => field.onChange(!field.value)}>
                                                                <FormLabel className="font-bold text-sm cursor-pointer">Se entregó control remoto</FormLabel>
                                                                <p className="text-xs text-muted-foreground">Confirmar la entrega física del dispositivo.</p>
                                                            </div>
                                                            <FormControl>
                                                                <Switch checked={field.value} onCheckedChange={field.onChange} id="createreservationdialog-switch-remote" data-testid="createreservationdialog-remote-switch" />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            )}

                                            {!initialRoomId && isWalkIn && (
                                                <FormField
                                                    control={form.control}
                                                    name="checkInNow"
                                                    render={({ field }) => (
                                                         <FormItem className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border bg-muted/20 p-4 transition-colors">
                                                             <div className={cn("space-y-0.5 flex-1", !isWalkIn && "cursor-pointer")} onClick={() => !isWalkIn && field.onChange(!field.value)}>
                                                                 <FormLabel className={cn("font-bold text-sm", !isWalkIn && "cursor-pointer")}>Ingreso Inmediato</FormLabel>
                                                                 <p className="text-xs text-muted-foreground">El tiempo empieza a correr al momento de dar el alta.</p>
                                                             </div>
                                                             <FormControl>
                                                                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isWalkIn} id="createreservationdialog-switch-1" data-testid="createreservationdialog-check-in-now-switch" />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            )}

                                            {!checkInNow && (
                                                <div className="rounded-xl border bg-muted/20 p-4 animate-in slide-in-from-top-2 duration-200">
                                                    <Controller
                                                        control={form.control}
                                                        name="checkInDate"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Fecha y Hora de Entrada</FormLabel>
                                                                <DateTimePicker date={field.value} setDate={field.onChange} />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            )}

                                            {checkInNow && (
                                                <FormField
                                                    control={form.control}
                                                    name="isOpenAccount"
                                                    render={({ field }) => (
                                                         <FormItem className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border p-4 bg-muted/10 transition-colors">
                                                            <div className="space-y-0.5 cursor-pointer flex-1" onClick={() => field.onChange(!field.value)}>
                                                                 <FormLabel className="font-bold text-sm cursor-pointer">Manejar como Cuenta Abierta</FormLabel>
                                                                <p className="text-xs text-muted-foreground">Se liquida el saldo total al salir.</p>
                                                            </div>
                                                             <FormControl>
                                                                <Switch checked={field.value} onCheckedChange={field.onChange} id="createreservationdialog-switch-2" data-testid="createreservationdialog-open-account-switch" />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            )}

                                            {calculatedCheckOut && (
                                                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 flex items-center gap-3">
                                                    <Clock className="h-5 w-5 text-primary" />
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase text-muted-foreground">Salida Estimada</p>
                                                        <p className="font-bold text-sm">{format(calculatedCheckOut, "eeee dd 'de' MMMM, h:mm a", { locale: es })}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                            
                                            {!initialRoomId && (
                                                <FormField
                                                    control={form.control}
                                                    name="roomId"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Habitación Asignada (Disponibles)</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingRooms || isWalkIn}>
                                                                <FormControl>
                                                                    <SelectTrigger className="h-12 text-lg" id="createreservationdialog-selecttrigger-1" data-testid="createreservationdialog-room-select">
                                                                        <SelectValue placeholder="Seleccione habitación" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {availableRooms.length > 0 ? (
                                                                        availableRooms.map(room => (
                                                                            <SelectItem key={room.id} value={room.id}>
                                                                                <div className='flex items-center gap-2'>
                                                                                    <span className='font-black'>Hab. {room.number}</span>
                                                                                    <span className='text-xs opacity-60'>— {room.roomTypeName}</span>
                                                                                </div>
                                                                            </SelectItem>
                                                                        ))
                                                                    ) : (
                                                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                                                            No hay habitaciones disponibles.
                                                                        </div>
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
                                            
                                            <FormField
                                                control={form.control}
                                                name="pricePlanName"
                                                render={({ field }) => (
                                                    <FormItem className="mb-4">
                                                        <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Plan de Estancia</FormLabel>
                                                        <Select onValueChange={(value) => field.onChange(value)} value={field.value} disabled={isLoading || availablePlans.length === 0}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-12 text-lg" id="createreservationdialog-selecttrigger-2" data-testid="createreservationdialog-plan-select">
                                                                    <SelectValue placeholder="Seleccione plan de tiempo" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {availablePlans.map(plan => {
                                                                    const unitLabel = plan.unit === 'Hours' ? (plan.duration === 1 ? 'Hora' : 'Horas') :
                                                                                      plan.unit === 'Minutes' ? (plan.duration === 1 ? 'Minuto' : 'Minutos') :
                                                                                      plan.unit === 'Days' ? (plan.duration === 1 ? 'Día' : 'Días') :
                                                                                      plan.unit === 'Weeks' ? (plan.duration === 1 ? 'Semana' : 'Semanas') :
                                                                                      plan.unit === 'Months' ? (plan.duration === 1 ? 'Mes' : 'Meses') : plan.unit;
                                                                    const formattedDuration = `${plan.duration} ${unitLabel}`;
                                                                    // Si el nombre del plan ya incluye el tiempo o son similares, no lo repetimos
                                                                    const label = plan.name.includes(formattedDuration) || 
                                                                                  plan.name === `${plan.duration} Minuto` || 
                                                                                  plan.name === formattedDuration ? 
                                                                                  plan.name : `${plan.name} - ${formattedDuration}`;
                                                                    return (
                                                                        <SelectItem key={plan.name} value={plan.name}>
                                                                            <div className="flex justify-between w-full gap-8">
                                                                                <span className="font-bold">{label}</span>
                                                                            </div>
                                                                        </SelectItem>
                                                                    );
                                                                })}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {selectedPlan?.perPerson && (
                                                <div className="mb-4 space-y-2 p-3 bg-muted/20 rounded-xl border border-muted">
                                                    <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Cantidad de Personas</FormLabel>
                                                    <div className="flex items-center gap-4 justify-center py-2">
                                                        <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => setGuestCount(Math.max(1, guestCount - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                                                        <span className="text-2xl font-black w-8 text-center">{guestCount}</span>
                                                        <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => setGuestCount(guestCount + 1)}><ChevronRight className="h-4 w-4" /></Button>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground text-center font-medium">Este plan cobra por persona.</p>
                                                </div>
                                            )}

                                             {checkInNow ? (
                                                 <>
                                                     {!isOpenAccount && (
                                                         <div className="space-y-4 rounded-xl border p-4 bg-background shadow-sm border-primary/20">
                                                             <FormField
                                                                  control={form.control}
                                                                  name="paymentMethod"
                                                                  render={({ field }) => (
                                                                      <FormItem>
                                                                          <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Método de Pago Adelantado</FormLabel>
                                                                          <div className="grid grid-cols-3 gap-2 mt-2">
                                                                              {[
                                                                                  { value: 'Efectivo', label: 'Efectivo', icon: <Wallet className="h-4 w-4" /> },
                                                                                  { value: 'Sinpe Movil', label: 'Sinpe Móvil', icon: <Smartphone className="h-4 w-4" /> },
                                                                                  { value: 'Tarjeta', label: 'Tarjeta', icon: <CreditCard className="h-4 w-4" /> }
                                                                              ].map(method => (
                                                                                  <Button
                                                                                      key={method.value}
                                                                                      type="button"
                                                                                      variant={field.value === method.value ? 'default' : 'outline'} disabled={selectedPlan?.unit === 'Months' && method.value !== 'Efectivo'} onClick={() => {
                                                                                           field.onChange(method.value);
                                                                                           if (method.value === "Efectivo") {
                                                                                               form.setValue("voucherNumber", null);
                                                                                               form.setValue("paymentConfirmed", false);
                                                                                           } else if (method.value === "Tarjeta") {
                                                                                               setCashTendered("");
                                                                                               form.setValue("paymentConfirmed", false);
                                                                                           } else if (method.value === "Sinpe Movil") {
                                                                                               setCashTendered("");
                                                                                               form.setValue("voucherNumber", null);
                                                                                           }
                                                                                       }}
                                                                                      className={cn(
                                                                                          "h-14 flex flex-col items-center justify-center gap-1 font-bold",
                                                                                          field.value === method.value ? "bg-primary text-white border-primary" : "text-muted-foreground hover:text-white"
                                                                                      )}
                                                                                  >
                                                                                      {method.icon}
                                                                                      <span className="text-xs">{method.label}</span>
                                                                                  </Button>
                                                                              ))}
                                                                          </div>
                                                                          <FormMessage />
                                                                      </FormItem>
                                                                  )}
                                                              />
                                                             {paymentMethod === 'Sinpe Movil' && (
                                                                 <div className='pt-4 border-t space-y-3'>
                                                                     {targetSinpeAccount ? (
                                                                         <div className='p-4 bg-primary/5 rounded-xl text-center border-2 border-dashed border-primary/20'>
                                                                             <p className='text-xs font-bold text-muted-foreground uppercase mb-2'>Enviar {formatCurrency(selectedPlan?.perPerson ? selectedPlan.price * guestCount : (selectedPlan?.price || 0))} a:</p>
                                                                             <p className='text-2xl font-black font-mono text-primary'>{targetSinpeAccount.phoneNumber.replace('(506) ', '')}</p>
                                                                             <p className='text-[10px] font-black uppercase text-muted-foreground'>{targetSinpeAccount.accountHolder}</p>
                                                                             <FormField
                                                                                 control={form.control}
                                                                                 name="paymentConfirmed"
                                                                                 render={({ field }) => (
                                                                                     <div className="space-y-3">
                                                                                     <FormItem>
                                                                                         <div className="flex items-center space-x-3 space-y-0 rounded-lg border bg-background p-3 mt-4 text-left">
                                                                                             <FormControl>
                                                                                                 <Checkbox checked={field.value} onCheckedChange={field.onChange} id="createreservationdialog-checkbox-payment" data-testid="createreservationdialog-payment-confirmed-checkbox" />
                                                                                             </FormControl>
                                                                                             <label htmlFor="createreservationdialog-checkbox-payment" className="text-xs font-bold cursor-pointer flex-1 py-2">Pago verificado</label>
                                                                                         </div>
                                                                                     </FormItem>
                                                                                         <p className="text-[9px] text-muted-foreground px-1 leading-tight italic text-left">
                                                                                             * Es responsabilidad del colaborador verificar manualmente que el pago por SINPE Móvil se haya recibido correctamente en la cuenta bancaria antes de finalizar.
                                                                                         </p>
                                                                                     </div>
                                                                                 )}
                                                                             />
                                                                         </div>
                                                                     ) : (
                                                                          <div className='p-3 bg-white/5 text-slate-500 rounded-lg text-xs font-bold text-center border border-white/10 uppercase'>
                                                                              {!selectedPlan ? 'Seleccione un plan de estancia' : 'Límite diario excedido'}
                                                                          </div>
                                                                      )}
                                                                 </div>
                                                             )}
                                                             {paymentMethod === 'Tarjeta' && (
                                                                 <FormField
                                                                     control={form.control}
                                                                     name="voucherNumber"
                                                                     render={({ field }) => (
                                                                          <FormItem><FormLabel className="text-xs font-bold">N° Voucher</FormLabel><FormControl><Input {...field} value={field.value || ""} maxLength={10} className="h-11 font-mono" id="createreservationdialog-input-1" data-testid="createreservationdialog-voucher-number-input" /></FormControl><FormMessage /></FormItem>
                                                                     )}
                                                                 />
                                                             )}
                                                             {paymentMethod === 'Efectivo' && (
                                                                 <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                                                     <FormItem><FormLabel className="text-xs font-bold">Paga con</FormLabel><FormControl><Input type="text" inputMode="numeric" value={cashTendered} onChange={handleCashTenderedChange} className="text-right h-11" id="createreservationdialog-input-2" data-testid="createreservationdialog-cash-tendered-input" /></FormControl></FormItem>
                                                                     {numericCashTendered >= (selectedPlan?.perPerson ? selectedPlan.price * guestCount : (selectedPlan?.price || 0)) && (
                                                                         <div className="text-right"><span className="text-[10px] font-black uppercase text-muted-foreground">Vuelto</span><p className="text-xl font-black text-primary">{formatCurrency(numericCashTendered - (selectedPlan?.perPerson ? selectedPlan.price * guestCount : (selectedPlan?.price || 0)))}</p></div>
                                                                     )}
                                                                 </div>
                                                             )}
                                                         </div>
                                                     )}
                                                 </>
                                             ) : (
                                                 <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-4 bg-primary/5 rounded-[2rem] border border-dashed border-primary/20">
                                                     <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                                                         <CalendarDays className="h-8 w-8 text-primary" />
                                                     </div>
                                                     <div className="space-y-1">
                                                         <h3 className="text-lg font-black uppercase italic tracking-tighter">Reservación Confirmada</h3>
                                                         <p className="text-xs text-slate-400 font-medium max-w-[280px]">
                                                             El pago se procesará físicamente cuando el cliente se presente al local para su ingreso.
                                                         </p>
                                                     </div>
                                                     <div className="flex items-center gap-2 px-4 py-2 bg-black/20 rounded-xl border border-white/5">
                                                         <Clock className="h-4 w-4 text-primary" />
                                                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Pendiente de Cobro</span>
                                                     </div>
                                                 </div>
                                             )}

                                             {isWalkIn && (
                                                 <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 shadow-xl shadow-primary/5">
                                                     <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Resumen de la Estancia</h4>
                                                     <div className="space-y-2 text-sm">
                                                         <div className="flex justify-between"><span>Habitación:</span><span className="font-bold">{selectedRoom?.number} ({selectedRoom?.roomTypeName})</span></div>
                                                         <div className="flex justify-between"><span>Huésped:</span><span className="font-bold">{guestNameValue}</span></div>
                                                         <Separator className="my-2" />
                                                         <div className="flex justify-between items-center text-lg font-black">
                                                             <span>Total Estancia</span>
                                                             <span className="text-primary">
                                                                 {formatCurrency((selectedPlan?.perPerson ? (selectedPlan.price * guestCount) : (selectedPlan?.price || 0)) + ((paymentMethod === 'Sinpe Movil' || paymentMethod === 'Tarjeta') ? 2000 : 0))}
                                                             </span>
                                                         </div>
                                                     </div>
                                                 </div>
                                             )}
                                        </div>
                                </div>

                                <DialogFooter className='pt-6 border-t mt-6 flex-row sm:justify-between items-center gap-4'>
                                    <div className='flex items-center gap-2'>
                                    </div>
                                    <div className='flex items-center gap-2 flex-1 sm:flex-none'>
                                        <Button
                                            type="button"
                                            disabled={isPending || isLoading || selectedClient?.isBlacklisted}
                                            onClick={() => form.handleSubmit(onSubmit)()}
                                            className="w-full sm:w-auto h-12 px-8 font-black uppercase tracking-widest shadow-primary/20 shadow-xl" id="createreservationdialog-button-1-1" data-testid="createreservationdialog-action-button"
                                        >
                                            {isPending ? 'Procesando...' : (
                                                <>
                                                    <CheckCircle className="mr-2 h-5 w-5" />
                                                    {selectedClient?.isBlacklisted ? 'Huésped Bloqueado' : (checkInNow ? 'Finalizar e Ingresar' : 'Confirmar Reserva')}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </DialogFooter>
                            </form>
                        </Form>
                    </div>
                </DialogContent>
            </Dialog>
            <InvoiceSuccessDialog open={successModalOpen} onOpenChange={setSuccessModalOpen} invoiceId={invoiceId} />
            <ReservationSuccessDialog open={reservationSuccessModalOpen} onOpenChange={setReservationSuccessModalOpen} reservationId={reservationId} />
            
            <Dialog open={showAddForeignerModal} onOpenChange={(isOpen) => {
                setShowAddForeignerModal(isOpen);
                if (!isOpen) {
                    setForeignerIsNational(false);
                    setForeignerNotes('');
                }
            }}>
                <DialogContent className="w-[95vw] max-w-md bg-background/95 backdrop-blur-xl border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle>{foreignerIsNational ? 'Registrar Cliente Nacional' : 'Registrar Cliente Extranjero'}</DialogTitle>
                        <DialogDescription>
                            {foreignerIsNational ? 'Ingrese los datos básicos del cliente.' : 'Ingrese los datos básicos del cliente extranjero.'}
                        </DialogDescription>
                    </DialogHeader>
                    
                    {foreignerIsNational && (
                        <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-500 py-2 px-3">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <AlertTitle className="text-sm font-black uppercase tracking-widest">No Encontrado</AlertTitle>
                            <AlertDescription className="text-xs">
                                El cliente no existe en el registro nacional. ¿Desea registrarlo manualmente?
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cédula / Pasaporte</label>
                            <Input placeholder="Número de identificación..." value={foreignerId} onChange={(e) => setForeignerId(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre</label>
                            <Input placeholder="Nombre..." value={foreignerName} onChange={(e) => setForeignerName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Apellidos</label>
                            <Input placeholder="Apellidos..." value={foreignerLastName} onChange={(e) => setForeignerLastName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Notas (Opcional)</label>
                            <Textarea placeholder="Notas..." value={foreignerNotes} onChange={(e) => setForeignerNotes(e.target.value)} className="h-20" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setShowAddForeignerModal(false)}>Cancelar</Button>
                        <Button type="button" onClick={handleSaveForeigner}>Registrar y Seleccionar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AddClientDialog 
                open={showAddClientModal} 
                onOpenChange={setShowAddClientModal} 
                client={prefilledClient} 
            />
        </>
    );
}


