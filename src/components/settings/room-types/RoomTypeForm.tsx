'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { RoomType, PricePlan } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Pencil, GripVertical } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { formatCurrency, cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { addDoc, collection, doc, getDocs, updateDoc } from 'firebase/firestore';

interface RoomTypeFormProps {
  roomType?: RoomType;
  allRoomTypes?: RoomType[];
}

const pricePlanSchema = z.object({
  name: z.string(),
  duration: z.coerce.number().positive('La duración debe ser un número positivo.'),
  unit: z.enum(['Minutes', 'Hours', 'Days', 'Weeks', 'Months']),
  price: z.coerce.number().min(0, 'El precio debe ser un número no negativo.'),
  capacity: z.coerce.number().optional(),
  isVisibleOnWeb: z.boolean().default(true),
});

const roomTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'El nombre es demasiado corto.'),
  capacity: z.coerce.number().int().min(1, 'La capacidad debe ser al menos 1.'),
  features: z.array(z.string()).optional(),
  pricePlans: z.array(pricePlanSchema).min(1, 'Debe agregar al menos un plan de precios.'),
  showOnLandingPage: z.boolean().default(true),
});

const stringToNumber = (numString: string): number => {
    if (!numString) return 0;
    // Remove thousand separators (commas) and parse as float.
    const sanitized = numString.replace(/,/g, '');
    return parseFloat(sanitized);
};

const numberToString = (num: number): string => {
    if (isNaN(num)) return '';
    // Format to a string like 10,000.00
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};


export default function RoomTypeForm({ roomType, allRoomTypes = [] }: RoomTypeFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [newFeature, setNewFeature] = useState('');
  
  const [newPlanDuration, setNewPlanDuration] = useState('');
  const [newPlanUnit, setNewPlanUnit] = useState<PricePlan['unit']>('Hours');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [newPlanCustomName, setNewPlanCustomName] = useState('');
  const [newPlanCapacity, setNewPlanCapacity] = useState('');
  const [editingPlanIndex, setEditingPlanIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [planInputErrors, setPlanInputErrors] = useState<{ duration?: string, price?: string }>({});

  const router = useRouter();
  const { firestore } = useFirebase();

  const form = useForm<z.infer<typeof roomTypeSchema>>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: roomType ? {
        ...roomType,
        capacity: roomType.capacity || 1,
        features: roomType.features || [],
        pricePlans: roomType.pricePlans || [],
    } : {
      name: '',
      capacity: 1,
      features: [],
      pricePlans: [],
      showOnLandingPage: true,
    },
  });

  const { formState: { errors } } = form;
  const features = form.watch('features', roomType?.features || []);
  const pricePlans = form.watch('pricePlans', roomType?.pricePlans || []);

  const roomCapacity = form.watch('capacity');

  useEffect(() => {
    if (!newPlanCapacity && roomCapacity) {
      setNewPlanCapacity(String(roomCapacity));
    }
  }, [roomCapacity, newPlanCapacity]);

  const allGlobalFeatures = useMemo(() => {
    const featureSet = new Set<string>();
    allRoomTypes.forEach(rt => {
      rt.features?.forEach(f => featureSet.add(f));
    });
    return Array.from(featureSet).sort();
  }, [allRoomTypes]);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const trimmedInput = newFeature.trim();
    if (trimmedInput) {
        const filteredGlobalSuggestions = allGlobalFeatures.filter(f => 
            f.toLowerCase().includes(trimmedInput.toLowerCase()) && 
            !features.includes(f)
        );
        
        const isAlreadyAdded = features.some(f => f.toLowerCase() === trimmedInput.toLowerCase());
        
        const exactMatchExists = filteredGlobalSuggestions.some(f => f.toLowerCase() === trimmedInput.toLowerCase());

        if (!isAlreadyAdded && !exactMatchExists) {
            setSuggestions([trimmedInput, ...filteredGlobalSuggestions]);
        } else {
            setSuggestions(filteredGlobalSuggestions);
        }
    } else {
        setSuggestions([]);
    }
  }, [newFeature, allGlobalFeatures, features]);


  const handleAddFeature = (featureToAdd?: string) => {
    const feature = (featureToAdd || newFeature).trim();
    if (feature && !features.includes(feature)) {
      form.setValue('features', [...features, feature], { shouldValidate: true });
      setNewFeature('');
      setShowSuggestions(false);
    }
  };

  const handleRemoveFeature = (indexToRemove: number) => {
    const newFeatures = features.filter((_, index) => index !== indexToRemove);
    form.setValue('features', newFeatures);
  };
  
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d]/g, ''); // only digits
    
    if (value === '') {
        setNewPlanPrice('');
        if (planInputErrors.price) {
            setPlanInputErrors(prev => ({...prev, price: undefined}));
        }
        return;
    }
    
    // remove leading zeros
    value = value.replace(/^0+/, '');

    while (value.length < 3) {
      value = '0' + value;
    }

    const integerPart = value.slice(0, value.length - 2);
    const decimalPart = value.slice(value.length - 2);
    
    const formattedInteger = new Intl.NumberFormat('en-US').format(parseInt(integerPart, 10));

    setNewPlanPrice(`${formattedInteger}.${decimalPart}`);
    
    if (planInputErrors.price) {
        setPlanInputErrors(prev => ({...prev, price: undefined}));
    }
  };

  const handleSavePlan = () => {
    const durationNum = parseInt(newPlanDuration, 10);
    const priceNum = stringToNumber(newPlanPrice);

    const currentErrors: { duration?: string; price?: string } = {};

    if (isNaN(durationNum) || durationNum <= 0) {
      currentErrors.duration = 'Debe ser un número positivo.';
    }


    if (isNaN(priceNum) || priceNum < 0) {
      currentErrors.price = 'Debe ser un número no negativo.';
    }

    const roomTypeName = form.getValues('name');
    if (roomTypeName.toUpperCase().includes('VIP') && newPlanUnit === 'Months') {
        currentErrors.duration = 'Las habitaciones VIP no se pueden alquilar al mes.';
    }

    setPlanInputErrors(currentErrors);
    
    if (Object.keys(currentErrors).length > 0) {
      return;
    }

    const unitMapSingular: Record<PricePlan['unit'], string> = {
        Minutes: 'Minuto',
        Hours: 'Hora',
        Days: 'Día',
        Weeks: 'Semana',
        Months: 'Mes'
    };
    const unitMapPlural: Record<PricePlan['unit'], string> = {
        Minutes: 'Minutos',
        Hours: 'Horas',
        Days: 'Días',
        Weeks: 'Semanas',
        Months: 'Meses'
    };
    const unitText = durationNum === 1 ? unitMapSingular[newPlanUnit] : unitMapPlural[newPlanUnit];
    const capacityNum = parseInt(newPlanCapacity, 10);
    const generatedName = `${durationNum} ${unitText}${!isNaN(capacityNum) ? ` (${capacityNum} Pers)` : ''}`;
    const newPlanName = newPlanCustomName.trim() || generatedName;

    if (pricePlans.some((p, i) => p.name === newPlanName && i !== editingPlanIndex)) {
        setPlanInputErrors(prev => ({...prev, duration: 'Ya existe un plan con este nombre.'}));
        return;
    }

    const newPlan: PricePlan = { 
        name: newPlanName, 
        duration: durationNum, 
        unit: newPlanUnit, 
        price: priceNum, 
        capacity: isNaN(capacityNum) ? undefined : capacityNum,
        isVisibleOnWeb: true // Default to true for new plans
    };
    
    if (editingPlanIndex !== null) {
      const updatedPlans = [...pricePlans];
      const existingPlan = updatedPlans[editingPlanIndex];
      updatedPlans[editingPlanIndex] = { ...newPlan, isVisibleOnWeb: existingPlan.isVisibleOnWeb ?? true };
      form.setValue('pricePlans', updatedPlans, { shouldValidate: true });
    } else {
      form.setValue('pricePlans', [...pricePlans, newPlan], { shouldValidate: true });
    }

    setEditingPlanIndex(null);
    setNewPlanDuration('');
    setNewPlanPrice('');
    setNewPlanCustomName('');
    setNewPlanCapacity('');
    setNewPlanUnit('Hours');
  };

  const handleEditPlan = (index: number) => {
    const plan = pricePlans[index];
    setEditingPlanIndex(index);
    setNewPlanDuration(String(plan.duration));
    setNewPlanUnit(plan.unit);
    setNewPlanPrice(numberToString(plan.price));
    setNewPlanCustomName(plan.name);
    setNewPlanCapacity(plan.capacity ? String(plan.capacity) : '');
    setPlanInputErrors({});
  };

  const handleCancelEdit = () => {
    setEditingPlanIndex(null);
    setNewPlanDuration('');
    setNewPlanPrice('');
    setNewPlanCustomName('');
    setNewPlanCapacity('');
    setNewPlanUnit('Hours');
    setPlanInputErrors({});
  };

  const handleRemovePlan = (indexToRemove: number) => {
    const newPlans = pricePlans.filter((_, index) => index !== indexToRemove);
    form.setValue('pricePlans', newPlans, { shouldValidate: true });
  };

  const handleTogglePlanVisibility = (index: number, isVisible: boolean) => {
    const newPlans = [...pricePlans];
    newPlans[index] = { ...newPlans[index], isVisibleOnWeb: isVisible };
    form.setValue('pricePlans', newPlans, { shouldValidate: true });
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const newPlans = [...pricePlans];
    const [movedPlan] = newPlans.splice(fromIndex, 1);
    newPlans.splice(toIndex, 0, movedPlan);
    form.setValue('pricePlans', newPlans, { shouldValidate: true });
  };

  const onSubmit = (values: z.infer<typeof roomTypeSchema>) => {
    startTransition(async () => {
      try {
        const dataToSave: Omit<RoomType, 'id' | 'code'> & { code?: string } = {
          name: values.name,
          capacity: values.capacity,
          features: values.features || [],
          pricePlans: values.pricePlans || [],
          showOnLandingPage: values.showOnLandingPage,
        };

        if (roomType?.id) {
          // Update
          const roomTypeRef = doc(firestore, 'roomTypes', roomType.id);
          await updateDoc(roomTypeRef, dataToSave as any);
        } else {
          // Create
          const roomTypesCollection = collection(firestore, 'roomTypes');
          const roomTypesSnapshot = await getDocs(roomTypesCollection);
          const existingCodes = roomTypesSnapshot.docs
            .map((doc) => parseInt(doc.data().code, 10))
            .filter((c) => !isNaN(c));

          const nextCodeNumber =
            existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
          
          dataToSave.code = String(nextCodeNumber).padStart(2, '0');

          await addDoc(collection(firestore, 'roomTypes'), dataToSave);
        }
        
        router.push('/settings/room-types');

      } catch (error: any) {
        console.error('Failed to save room type:', error);
        toast({
          title: 'Error al Guardar',
          description: error.message || 'Ocurrió un error inesperado. Es posible que no tenga permisos.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddFeature();
    }
  };

  return (
    <Form {...form}>
       <form id="room-type-form" onSubmit={form.handleSubmit(onSubmit)} data-testid="roomtypeform-main-form">
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-8">
                <div className="grid md:grid-cols-3 gap-4">
                  <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                      <FormItem className="md:col-span-2">
                          <FormLabel>Nombre del Tipo de Habitación</FormLabel>
                          <FormControl>
                          <Input
                              placeholder="p.ej., Suite Presidencial"
                              {...field} id="roomtypeform-input-p-ej-suite-presidencial" data-testid="roomtypeform-1-input"
                          />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                   <FormField
                      control={form.control}
                      name="capacity"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>Capacidad</FormLabel>
                          <FormControl>
                          <Input type="number" min="1" {...field} className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" id="roomtypeform-input-1" data-testid="roomtypeform-2-input" />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  </div>

                  <FormField
                      control={form.control}
                      name="showOnLandingPage"
                      render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-primary/5 border-primary/20">
                          <div className="space-y-0.5">
                          <FormLabel className="text-base">Mostrar en Landing Page</FormLabel>
                          <div className="text-sm text-muted-foreground italic">
                              Habilita esta opción para que el tipo de habitación aparezca en el sitio público.
                          </div>
                          </div>
                          <FormControl>
                          <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange} id="roomtypeform-switch-1" data-testid="roomtypeform-1-switch"
                          />
                          </FormControl>
                      </FormItem>
                      )}
                  />

                  <Separator />

                  <div className="space-y-4">
                      <FormLabel>Planes de Precios</FormLabel>
                      <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                        <div className="grid grid-cols-1 sm:grid-cols-10 gap-x-4 gap-y-2 items-end">
                          <div className="sm:col-span-3 space-y-2">
                              <Label htmlFor="plan-custom-name">Nombre (Opcional)</Label>
                              <Input
                                  id="plan-custom-name"
                                  placeholder="Ej: Mensual 1 Pers"
                                  value={newPlanCustomName}
                                  onChange={(e) => setNewPlanCustomName(e.target.value)}
                                  className="h-10"
                              />
                          </div>
                          <div className="sm:col-span-1 space-y-2">
                              <Label htmlFor="plan-duration" className={cn(planInputErrors.duration && "text-destructive")}>Duración</Label>
                              <Input
                                  id="plan-duration"
                                  type="number"
                                  placeholder="8"
                                  value={newPlanDuration}
                                  onChange={(e) => {
                                    setNewPlanDuration(e.target.value);
                                    if(planInputErrors.duration) setPlanInputErrors(p => ({...p, duration: undefined}));
                                  }}
                                  className={cn("text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", planInputErrors.duration && "border-destructive focus-visible:ring-destructive")} data-testid="roomtypeform-3-input"
                              />
                              {planInputErrors.duration && <p className="text-sm font-medium text-destructive">{planInputErrors.duration}</p>}
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <Label htmlFor="plan-unit">Unidad</Label>
                            <Select value={newPlanUnit} onValueChange={(value) => setNewPlanUnit(value as any)}>
                                <FormControl>
                                  <SelectTrigger id="plan-unit" data-testid="roomtypeform-1-select">
                                      <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Minutes">Minutos</SelectItem>
                                  <SelectItem value="Hours">Horas</SelectItem>
                                  <SelectItem value="Days">Días</SelectItem>
                                  <SelectItem value="Weeks">Semanas</SelectItem>
                                  <SelectItem value="Months">Meses</SelectItem>
                                </SelectContent>
                            </Select>
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <Label htmlFor="plan-price" className={cn(planInputErrors.price && "text-destructive")}>Precio</Label>
                            <Input
                                id="plan-price"
                                type="text"
                                inputMode='text'
                                placeholder="10,000.00"
                                value={newPlanPrice}
                                onChange={handlePriceChange}
                                className={cn("text-right", planInputErrors.price && "border-destructive focus-visible:ring-destructive")} data-testid="roomtypeform-4-input"
                            />
                             {planInputErrors.price && <p className="text-sm font-medium text-destructive">{planInputErrors.price}</p>}
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <Label htmlFor="plan-capacity">Capacidad (Huéspedes)</Label>
                            <Input
                                id="plan-capacity"
                                type="text"
                                inputMode="numeric"
                                placeholder="Ej: 2"
                                value={newPlanCapacity}
                                onChange={(e) => setNewPlanCapacity(e.target.value.replace(/\D/g, ''))}
                                className="h-10"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                              type="button"
                              onClick={handleSavePlan}
                              className="w-full sm:w-auto" id="roomtypeform-button-1" data-testid="roomtypeform-add-button"
                          >
                              <Plus className="h-4 w-4 mr-2" />
                              {editingPlanIndex !== null ? 'Actualizar Plan' : 'Añadir Plan'}
                          </Button>
                          {editingPlanIndex !== null && (
                              <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={handleCancelEdit} id="roomtypeform-button-cancelar" data-testid="roomtypeform-cancel-button"
                              >
                                  Cancelar
                              </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        {pricePlans.length > 0 ? (
                        <div className="rounded-md border">
                            <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead className="w-[40px]"></TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead className="text-right">Precio</TableHead>
                                <TableHead className="text-center w-[120px]">Visible en Web</TableHead>
                                <TableHead className="text-right w-[100px]">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pricePlans.map((plan, index) => (
                                <TableRow 
                                    key={`${plan.name}-${index}`}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/plain', index.toString());
                                      e.dataTransfer.effectAllowed = 'move';
                                      setDraggedIndex(index);
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = 'move';
                                      if (dragOverIndex !== index) {
                                        setDragOverIndex(index);
                                      }
                                    }}
                                    onDragLeave={() => {
                                      if (dragOverIndex === index) {
                                        setDragOverIndex(null);
                                      }
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                                      if (!isNaN(fromIndex)) {
                                        handleReorder(fromIndex, index);
                                      }
                                      setDraggedIndex(null);
                                      setDragOverIndex(null);
                                    }}
                                    onDragEnd={() => {
                                      setDraggedIndex(null);
                                      setDragOverIndex(null);
                                    }}
                                    className={cn(
                                      "transition-all duration-200",
                                      draggedIndex === index && "opacity-50 scale-[0.98] bg-primary/5",
                                      dragOverIndex === index && draggedIndex !== index && "border-t-2 border-t-primary bg-primary/10"
                                    )}
                                >
                                    <TableCell className="w-[40px] px-2 cursor-grab active:cursor-grabbing text-slate-500 hover:text-white">
                                        <GripVertical className="h-5 w-5" />
                                    </TableCell>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        {plan.name}
                                        {plan.capacity && (
                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase font-black tracking-widest bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{plan.capacity} Personas</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(plan.price)}</TableCell>
                                    <TableCell className="text-center">
                                        <Switch 
                                            checked={plan.isVisibleOnWeb !== false} 
                                            onCheckedChange={(checked) => handleTogglePlanVisibility(index, checked)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        onClick={() => handleEditPlan(index)}
                                        aria-label={`Editar ${plan.name}`} id={`roomtypeform-button-edit-${index}`} data-testid="roomtypeform-edit-button"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleRemovePlan(index)}
                                        aria-label={`Eliminar ${plan.name}`} id={`roomtypeform-button-delete-${index}`} data-testid="roomtypeform-close-button"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                            </Table>
                        </div>
                        ) : (
                        <p className="text-xs text-muted-foreground px-1 pt-2">
                          Aún no se han añadido planes de precios.
                        </p>
                        )}
                        {errors.pricePlans && (
                        <p className="text-sm font-medium text-destructive px-1 pt-1">
                          {errors.pricePlans.message}
                        </p>
                        )}
                      </div>
                  </div>
              </div>
              <div className="md:col-span-1">
                  <div className="p-4 border rounded-lg bg-muted/30 sticky top-24">
                    <FormItem>
                        <FormLabel>Características</FormLabel>
                        <div className="relative">
                          <div className="flex items-center gap-2">
                              <Input
                                  placeholder="p.ej. Wi-Fi de alta velocidad"
                                  value={newFeature}
                                  onChange={(e) => setNewFeature(e.target.value)}
                                  onKeyDown={handleEnterKey}
                                  onFocus={() => setShowSuggestions(true)}
                                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} id="roomtypeform-input-p-ej-wi-fi-de" data-testid="roomtypeform-5-input"
                              />
                              <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleAddFeature()} id="roomtypeform-button-4" data-testid="roomtypeform-add-button"
                              >
                                  <Plus className="h-4 w-4" />
                                  <span className="sr-only">Añadir Característica</span>
                              </Button>
                          </div>
                          {showSuggestions && suggestions.length > 0 && (
                              <div className="absolute z-10 w-full bg-card border rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                                  {suggestions.map((suggestion) => {
                                      const isNew = !allGlobalFeatures.some(f => f.toLowerCase() === suggestion.toLowerCase());
                                      return (
                                          <div
                                              key={suggestion}
                                              className="px-3 py-2 text-sm cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                              onMouseDown={() => handleAddFeature(suggestion)}
                                          >
                                             {isNew ? (
                                                  <span className="flex items-center gap-2">
                                                      <Plus className="h-4 w-4" />
                                                      <span className="text-foreground">Añadir: <span className="font-semibold">"{suggestion}"</span></span>
                                                  </span>
                                             ) : (
                                                 <span className="text-foreground">{suggestion}</span>
                                             )}
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                        </div>
                        <div className="space-y-2 pt-2">
                        {features.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                            {features.map((feature, index) => (
                                <Badge
                                key={index}
                                variant="secondary"
                                className="pl-2 pr-1 py-0.5 text-sm"
                                >
                                {feature}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveFeature(index)}
                                    className="ml-1.5 p-0.5 rounded-full hover:bg-destructive/20 text-destructive"
                                    aria-label={`Eliminar ${feature}`} id="roomtypeform-button-1-1" data-testid="roomtypeform-close-button"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                                </Badge>
                            ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground px-1">
                            Aún no se han añadido características.
                            </p>
                        )}
                        </div>
                    </FormItem>
                  </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t p-6">
              <Button asChild variant="outline" type="button" id="roomtypeform-button-5" data-testid="roomtypeform-action-button">
                <Link href="/settings/room-types" id="roomtypeform-link-cancelar" data-testid="roomtypeform-cancel-link">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={isPending} id="roomtypeform-button-6" data-testid="roomtypeform-submit-button">
                {isPending ? 'Guardando...' : 'Guardar'}
              </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
