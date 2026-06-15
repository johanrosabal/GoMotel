
'use client';

import { useState, useTransition, type ReactNode, useEffect, useRef } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveService } from '@/lib/actions/service.actions';
import type { Service, ProductCategory, ProductSubCategory, Tax, Supplier } from '@/types';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Image as ImageIcon, Info, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { formatCurrency } from '@/lib/utils';
import { useMemo } from 'react';

interface EditServiceDialogProps {
    children?: ReactNode;
    service?: Service;
    allServices: Service[];
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    categoryId?: string;
    subCategoryId?: string;
}

const serviceSchema = z.object({
    id: z.string().optional(),
    code: z.string().optional(),
    name: z.string().min(2, 'El nombre del servicio es demasiado corto.'),
    price: z.coerce.number().min(0, 'El precio de venta no puede ser negativo.'),
    costPrice: z.coerce.number().min(0, 'El precio de costo no puede ser negativo.').optional(),
    stock: z.coerce.number().int().min(0, 'Las existencias no pueden ser negativas.'),
    minStock: z.coerce.number().int().min(0, 'Las existencias mínimas no pueden ser negativas.').optional(),
    category: z.enum(['Food', 'Beverage', 'Amenity', 'Article']),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    categoryId: z.string().optional(),
    subCategoryId: z.string().optional(),
    isActive: z.boolean().optional().default(true),
    taxIds: z.array(z.string()).optional(),
    taxIncluded: z.boolean().optional().default(false),
    supplierId: z.string().optional(),
    supplierName: z.string().optional(),
    source: z.enum(['Purchased', 'Internal']).default('Purchased'),
    isPublic: z.boolean().optional().default(false),
});

const stringToNumber = (numString: string): number => {
    if (!numString) return 0;
    const sanitized = numString.replace(/,/g, '');
    return parseFloat(sanitized);
};

const numberToString = (num: number): string => {
    if (isNaN(num) || num === null) return '';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

export default function EditServiceDialog({ children, service, allServices, open: controlledOpen, onOpenChange: setControlledOpen, categoryId: preselectedCategoryId, subCategoryId: preselectedSubCategoryId }: EditServiceDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;

    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const [priceInput, setPriceInput] = useState('');
    const [costPriceInput, setCostPriceInput] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<z.infer<typeof serviceSchema>>({
        resolver: zodResolver(serviceSchema),
        defaultValues: service || {
            name: '',
            code: '',
            price: 0,
            costPrice: 0,
            stock: 0,
            minStock: 10,
            category: 'Food',
            description: '',
            imageUrl: '',
            categoryId: preselectedCategoryId,
            subCategoryId: preselectedSubCategoryId,
            isActive: true,
            taxIds: [],
            taxIncluded: false,
            supplierId: '',
            supplierName: '',
            source: 'Purchased',
            isPublic: false,
        },
    });

    const selectedCategoryId = form.watch('categoryId');
    const source = form.watch('source');

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<ProductCategory>(categoriesQuery);

    const subCategoriesQuery = useMemoFirebase(() => {
        if (!firestore || !selectedCategoryId) return null;
        return query(collection(firestore, 'productSubCategories'), where('categoryId', '==', selectedCategoryId), orderBy('name'));
    }, [firestore, selectedCategoryId]);
    const { data: subCategories, isLoading: isLoadingSubCategories } = useCollection<ProductSubCategory>(subCategoriesQuery);

    const productsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'products'), orderBy('name'));
    }, [firestore]);
    const { data: products } = useCollection<Service>(productsQuery);

    const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes'), orderBy('name')) : null, [firestore]);
    const { data: taxes, isLoading: isLoadingTaxes } = useCollection<Tax>(taxesQuery);

    const suppliersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'suppliers'), orderBy('name')) : null, [firestore]);
    const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersQuery);

    const watchPrice = form.watch('price');
    const watchCostPrice = form.watch('costPrice');
    const watchTaxIds = form.watch('taxIds');
    const watchTaxIncluded = form.watch('taxIncluded');

    const priceBreakdown = useMemo(() => {
        if (!taxes) return null;

        const selectedTaxes = taxes.filter(t => watchTaxIds?.includes(t.id));
        const cumulativeTaxPercentage = selectedTaxes.reduce((sum, t) => sum + t.percentage, 0);

        let subtotal = 0;
        let totalTaxAmount = 0;
        let finalPrice = 0;

        if (watchTaxIncluded) {
            finalPrice = watchPrice || 0;
            subtotal = finalPrice / (1 + cumulativeTaxPercentage / 100);
            totalTaxAmount = finalPrice - subtotal;
        } else {
            subtotal = watchPrice || 0;
            totalTaxAmount = subtotal * (cumulativeTaxPercentage / 100);
            finalPrice = subtotal + totalTaxAmount;
        }

        const profit = subtotal - (watchCostPrice || 0);
        const profitMargin = subtotal > 0 ? (profit / subtotal) * 100 : 0;

        return {
            subtotal,
            totalTaxAmount,
            finalPrice,
            profit,
            profitMargin,
            taxBreakdown: selectedTaxes.map(t => ({
                name: t.name,
                percentage: t.percentage,
                amount: subtotal * (t.percentage / 100)
            }))
        };
    }, [watchPrice, watchCostPrice, watchTaxIds, watchTaxIncluded, taxes]);

    useEffect(() => {
        if (open) {
            const defaultValues = service ? {
                ...service,
                categoryId: service.categoryId || preselectedCategoryId,
                subCategoryId: service.subCategoryId || preselectedSubCategoryId,
                imageUrl: service.imageUrl || '',
                costPrice: service.costPrice || 0,
                minStock: service.minStock ?? 10,
                isActive: service.isActive !== false,
                taxIds: service.taxIds || [],
                taxIncluded: service.taxIncluded || false,
                supplierId: service.supplierId || '',
                supplierName: service.supplierName || '',
                source: service.source || 'Purchased',
                isPublic: !!service.isPublic,
            } : {
                name: '',
                code: '',
                price: 0,
                costPrice: 0,
                stock: 0,
                minStock: 10,
                category: 'Food' as const,
                description: '',
                imageUrl: '',
                categoryId: preselectedCategoryId,
                subCategoryId: preselectedSubCategoryId,
                isActive: true,
                taxIds: [],
                taxIncluded: false,
                supplierId: '',
                supplierName: '',
                source: 'Purchased' as const,
                isPublic: false,
            };
            form.reset(defaultValues);
            setPriceInput(numberToString(defaultValues.price));
            setCostPriceInput(numberToString(defaultValues.costPrice || 0));
            setImagePreview(defaultValues.imageUrl || null);
        }
    }, [open, service, form, preselectedCategoryId, preselectedSubCategoryId]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                setImagePreview(dataUrl);
                form.setValue('imageUrl', dataUrl, { shouldValidate: true });
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/[^\d]/g, '');
        if (value === '') {
            setPriceInput('');
            form.setValue('price', 0);
            return;
        }
        value = value.replace(/^0+/, '');
        while (value.length < 3) {
            value = '0' + value;
        }
        const integerPart = value.slice(0, value.length - 2);
        const decimalPart = value.slice(value.length - 2);
        const formattedInteger = new Intl.NumberFormat('en-US').format(parseInt(integerPart, 10) || 0);
        const formattedValue = `${formattedInteger}.${decimalPart}`;
        setPriceInput(formattedValue);
        form.setValue('price', stringToNumber(formattedValue));
    };

    const handleCostPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/[^\d]/g, '');
        if (value === '') {
            setCostPriceInput('');
            form.setValue('costPrice', 0);
            return;
        }
        value = value.replace(/^0+/, '');
        while (value.length < 3) {
            value = '0' + value;
        }
        const integerPart = value.slice(0, value.length - 2);
        const decimalPart = value.slice(value.length - 2);
        const formattedInteger = new Intl.NumberFormat('en-US').format(parseInt(integerPart, 10) || 0);
        const formattedValue = `${formattedInteger}.${decimalPart}`;
        setCostPriceInput(formattedValue);
        form.setValue('costPrice', stringToNumber(formattedValue));
    };


    const onSubmit = (values: z.infer<typeof serviceSchema>) => {
        startTransition(async () => {
            try {
                const result = await saveService(values);
                if (result.error) {
                    const errorDescription = typeof result.error === 'object'
                        ? Object.values(result.error).flat().join(' \n')
                        : String(result.error);
                    toast({
                        title: 'Error al Guardar',
                        description: errorDescription,
                        variant: 'destructive',
                    });
                } else {
                    toast({
                        title: '¡Éxito!',
                        description: `El servicio "${values.name}" ha sido guardado.`,
                    });
                    setOpen(false);
                    form.reset();
                }
            } catch (error: any) {
                console.error("Error calling saveService:", error);
                toast({
                    title: 'Error de Conexión',
                    description: 'Ocurrió un error al enviar los datos. Si subió una imagen muy grande, intente con una más pequeña (máximo 1MB).',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {children && <DialogTrigger asChild>{children}</DialogTrigger>}
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 bg-background/80 backdrop-blur-xl border-white/5">
                <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
                    <DialogTitle>{service ? 'Editar Producto' : 'Añadir Nuevo Producto'}</DialogTitle>
                    <DialogDescription>
                        {service
                            ? `Actualizar detalles para ${service.name}.`
                            : 'Añadir un nuevo producto a su inventario.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto no-scrollbar">
                    <Form {...form}>
                        <form id="edit-service-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="editservicedialog-main-form">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                                {/* Columna Izquierda: Información Básica e Imagen */}
                                <div className="space-y-6">
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/80 mb-2">Identificación y Origen</h3>
                                        
                                        <FormField
                                            control={form.control}
                                            name="source"
                                            render={({ field }) => (
                                                <FormItem className="space-y-3">
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Fuente del Producto</FormLabel>
                                                    <FormControl>
                                                        <RadioGroup
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                            className="flex space-x-4"
                                                        >
                                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                                <FormControl>
                                                                    <RadioGroupItem value="Purchased" id="editservicedialog-radiogroupitem-1" data-testid="editservicedialog-product-source-purchased-radiogroupitem" />
                                                                </FormControl>
                                                                <FormLabel className="font-bold text-sm text-white/70">Comprado</FormLabel>
                                                            </FormItem>
                                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                                <FormControl>
                                                                    <RadioGroupItem value="Internal" id="editservicedialog-radiogroupitem-2" data-testid="editservicedialog-product-source-internal-radiogroupitem" />
                                                                </FormControl>
                                                                <FormLabel className="font-bold text-sm text-white/70">Producción Interna</FormLabel>
                                                            </FormItem>
                                                        </RadioGroup>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="grid grid-cols-3 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="name"
                                                render={({ field }) => (
                                                    <FormItem className="col-span-2">
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Nombre del Producto</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="p.ej., Botella de Agua" {...field} className="h-12 bg-white/[0.03] border-white/5 rounded-2xl px-4 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium placeholder:text-white/10 text-white" id="editservicedialog-input-p-ej-botella-de" data-testid="editservicedialog-product-name-input" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="code"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Código</FormLabel>
                                                        <FormControl>
                                                            <Input readOnly placeholder="Auto" {...field} className="h-12 bg-white/5 border-white/5 rounded-2xl px-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-mono text-center text-white/50" id="editservicedialog-input-auto-generado" data-testid="editservicedialog-product-code-input" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Descripción Promocional (Opcional)</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Descripción para el Menú de TV..."
                                                            className="resize-none h-20 bg-white/[0.03] border-white/5 rounded-2xl px-4 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium placeholder:text-white/10 text-white"
                                                            {...field}
                                                            id="editservicedialog-textarea-description" data-testid="editservicedialog-product-description-textarea"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/80 mb-2">Imagen y Visibilidad</h3>
                                        
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Imagen del Producto</FormLabel>
                                            <div className="flex flex-col gap-3 mt-1">
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleFileChange}
                                                    accept="image/*"
                                                    className="hidden" data-testid="editservicedialog-1-input"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="relative w-full h-48 rounded-2xl p-0 border-white/10 hover:border-primary/50 bg-white/[0.03] transition-all"
                                                    onClick={() => fileInputRef.current?.click()} id="editservicedialog-button-1" data-testid="editservicedialog-action-button"
                                                >
                                                    <Avatar className="h-full w-full rounded-2xl">
                                                        <AvatarImage src={imagePreview || undefined} alt={form.getValues('name')} className="object-cover" />
                                                        <AvatarFallback className="rounded-2xl bg-transparent flex items-center justify-center">
                                                            <ImageIcon className="h-12 w-12 text-white/20" />
                                                        </AvatarFallback>
                                                    </Avatar>
                                                </Button>
                                                <div className="flex flex-col gap-2 w-full text-center">
                                                    <p className="text-xs text-white/40 font-medium">Haga clic en el recuadro para buscar una imagen.</p>
                                                    {imagePreview && (
                                                        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive h-auto p-1 justify-center w-full text-xs font-bold uppercase tracking-wider" onClick={() => {
                                                            setImagePreview(null);
                                                            form.setValue('imageUrl', '');
                                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                                        }} id="editservicedialog-button-eliminar-imagen" data-testid="editservicedialog-delete-button">
                                                            Eliminar imagen
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <FormMessage />
                                        </FormItem>

                                        <FormField
                                            control={form.control}
                                            name="isPublic"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3 shadow-sm">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-xs font-bold text-white/70">Mostrar en Pantallas Públicas</FormLabel>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            Menú digital y auto-pedido.
                                                        </p>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange} id="editservicedialog-switch-is-public" data-testid="editservicedialog-product-public-switch"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="isActive"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3 shadow-sm">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-xs font-bold text-white/70">Producto Activo</FormLabel>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            Visible para venta.
                                                        </p>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange} id="editservicedialog-switch-1" data-testid="editservicedialog-product-active-switch"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Columna Derecha: Clasificación y Precios */}
                                <div className="space-y-6">
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/80 mb-2">Clasificación</h3>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="categoryId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Categoría</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingCategories}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-12 bg-white/[0.03] border-white/5 rounded-2xl px-4 focus:ring-primary/20 focus:border-primary/50 text-white" id="editservicedialog-selecttrigger-1" data-testid="editservicedialog-product-category-select"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="subCategoryId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Sub-Categoría</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingSubCategories || !selectedCategoryId}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-12 bg-white/[0.03] border-white/5 rounded-2xl px-4 focus:ring-primary/20 focus:border-primary/50 text-white" id="editservicedialog-selecttrigger-2" data-testid="editservicedialog-product-subcategory-select"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>{subCategories?.map(sc => <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="category"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Categoría de Cola (Destino)</FormLabel>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        defaultValue={field.value}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger className="h-12 bg-white/[0.03] border-white/5 rounded-2xl px-4 focus:ring-primary/20 focus:border-primary/50 text-white" id="editservicedialog-selecttrigger-4" data-testid="editservicedialog-product-accounting-category-select">
                                                                <SelectValue placeholder="Seleccione cola de producción" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Beverage">Cola de Bar</SelectItem>
                                                            <SelectItem value="Food">Cola de Cocina</SelectItem>
                                                            <SelectItem value="Amenity">Cola de Amenidades</SelectItem>
                                                            <SelectItem value="Article">Cola de Artículos</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {source === 'Purchased' && <FormField
                                            control={form.control}
                                            name="supplierId"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Proveedor (Opcional)</FormLabel>
                                                    <Select
                                                        onValueChange={(value) => {
                                                            const finalValue = value === 'none' ? '' : value;
                                                            field.onChange(finalValue);
                                                            const supplier = suppliers?.find(s => s.id === finalValue);
                                                            form.setValue('supplierName', supplier?.name || '');
                                                        }}
                                                        value={field.value || 'none'}
                                                        disabled={isLoadingSuppliers}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger className="h-12 bg-white/[0.03] border-white/5 rounded-2xl px-4 focus:ring-primary/20 focus:border-primary/50 text-white" id="editservicedialog-selecttrigger-3" data-testid="editservicedialog-product-supplier-select">
                                                                <SelectValue placeholder={isLoadingSuppliers ? "Cargando..." : "Seleccione un proveedor"} />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="none">Ninguno</SelectItem>
                                                            {suppliers?.map(supplier => (
                                                                <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />}
                                    </div>

                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/80 mb-2">Precios y Stock</h3>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            {source === 'Purchased' && <FormField
                                                control={form.control}
                                                name="costPrice"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Precio de Costo</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={costPriceInput}
                                                                onChange={handleCostPriceChange}
                                                                className="h-12 bg-white/[0.03] border-white/5 rounded-2xl px-4 focus:ring-primary/20 focus:border-primary/50 transition-all font-mono text-right text-white" id="editservicedialog-input-1" data-testid="editservicedialog-product-cost-price-input"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />}
                                            <FormField
                                                control={form.control}
                                                name="price"
                                                render={({ field }) => (
                                                    <FormItem className={source !== 'Purchased' ? 'col-span-2' : ''}>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Precio de Venta</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={priceInput}
                                                                onChange={handlePriceChange}
                                                                className="h-12 bg-white/[0.03] border-white/5 rounded-2xl px-4 focus:ring-primary/20 focus:border-primary/50 transition-all font-mono text-right text-white" id="editservicedialog-input-2" data-testid="editservicedialog-product-price-input"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        {source === 'Purchased' && <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="stock"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Existencias</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} className="h-12 bg-white/[0.03] border-white/5 rounded-2xl px-4 focus:ring-primary/20 focus:border-primary/50 transition-all font-mono text-right text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" id="editservicedialog-input-3" data-testid="editservicedialog-product-stock-input" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="minStock"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Exist. Mínimas</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} placeholder="10" className="h-12 bg-white/[0.03] border-white/5 rounded-2xl px-4 focus:ring-primary/20 focus:border-primary/50 transition-all font-mono text-right text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" id="editservicedialog-input-10" data-testid="editservicedialog-product-min-stock-input" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>}
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="taxIds"
                                        render={({ field }) => (
                                            <FormItem className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                                <div className="flex flex-row items-center justify-between mb-2">
                                                    <FormLabel className="text-xs font-black uppercase tracking-[0.2em] text-primary/80">Impuestos</FormLabel>
                                                    <FormField
                                                        control={form.control}
                                                        name="taxIncluded"
                                                        render={({ field: taxIncludedField }) => (
                                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Incluido</FormLabel>
                                                                <FormControl>
                                                                    <Switch
                                                                        checked={taxIncludedField.value}
                                                                        onCheckedChange={taxIncludedField.onChange} id="editservicedialog-switch-tax-included" data-testid="editservicedialog-product-tax-included-switch"
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                                <div className="space-y-2 max-h-32 overflow-y-auto no-scrollbar">
                                                    {isLoadingTaxes ? (
                                                        <p className="text-xs text-muted-foreground">Cargando impuestos...</p>
                                                    ) : taxes && taxes.length > 0 ? (
                                                        taxes.map((tax) => (
                                                            <FormItem
                                                                key={tax.id}
                                                                className="flex flex-row items-start space-x-3 space-y-0"
                                                            >
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={field.value?.includes(tax.id)}
                                                                        onCheckedChange={(checked) => {
                                                                            const currentIds = field.value || [];
                                                                            if (checked) {
                                                                                field.onChange([...currentIds, tax.id]);
                                                                            } else {
                                                                                field.onChange(
                                                                                    currentIds.filter((id) => id !== tax.id)
                                                                                );
                                                                            }
                                                                        }} id="editservicedialog-checkbox-1" data-testid="editservicedialog-product-tax-checkbox"
                                                                    />
                                                                </FormControl>
                                                                <FormLabel className="font-bold text-sm text-white/70">
                                                                    {tax.name} ({tax.percentage}%)
                                                                </FormLabel>
                                                            </FormItem>
                                                        ))
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">No hay impuestos configurados. <Link href="/settings/taxes" className="text-primary underline" id="editservicedialog-link-crear-uno" data-testid="editservicedialog-create-link">Crear uno</Link></p>
                                                    )}
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Price Breakdown Display */}
                                    {priceBreakdown && (
                                        <div className="rounded-2xl border border-white/5 bg-primary/5 p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-black uppercase tracking-tight flex items-center gap-2 text-primary">
                                                    <DollarSign className="h-3 w-3" />
                                                    Resumen de Cálculo
                                                </h4>
                                                {priceBreakdown.profitMargin > 0 ? (
                                                    <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <TrendingUp className="h-2.5 w-2.5" />
                                                        +{priceBreakdown.profitMargin.toFixed(1)}% margen
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <TrendingDown className="h-2.5 w-2.5" />
                                                        {priceBreakdown.profitMargin.toFixed(1)}% margen
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Base (Neto)</p>
                                                    <p className="text-sm font-mono font-bold text-white">{formatCurrency(priceBreakdown.subtotal)}</p>
                                                </div>
                                                <div className="space-y-1 text-right">
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Impuestos</p>
                                                    <p className="text-sm font-mono font-bold text-primary">+{formatCurrency(priceBreakdown.totalTaxAmount)}</p>
                                                </div>
                                            </div>

                                            <Separator className="opacity-10" />

                                            <div className="space-y-2">
                                                {priceBreakdown.taxBreakdown.length > 0 && (
                                                    <div className="space-y-1">
                                                        {priceBreakdown.taxBreakdown.map((t, idx) => (
                                                            <div key={idx} className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                                                <span className="text-white/40">{t.name} ({t.percentage}%):</span>
                                                                <span className="font-mono text-white/70">{formatCurrency(t.amount)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="flex justify-between items-center py-2 px-3 bg-primary/10 rounded-xl mt-2">
                                                    <p className="text-xs font-black uppercase text-primary">Total Venta:</p>
                                                    <p className="text-lg font-black font-mono text-white">{formatCurrency(priceBreakdown.finalPrice)}</p>
                                                </div>

                                                <div className="flex justify-between items-center px-3">
                                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Utilidad Estimada:</p>
                                                    <p className={`text-sm font-black font-mono ${priceBreakdown.profit >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                                                        {formatCurrency(priceBreakdown.profit)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </Form>
                </div>

                <DialogFooter className="p-6 pt-4 border-t bg-background flex-shrink-0">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} id="editservicedialog-button-cancelar" data-testid="editservicedialog-cancel-button">Cancelar</Button>
                    <Button type="submit" form="edit-service-form" disabled={isPending} id="editservicedialog-button-2" data-testid="editservicedialog-submit-button">
                        {isPending ? 'Guardando...' : 'Guardar Producto'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
