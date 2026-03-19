
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
  category: z.enum(['Food', 'Beverage', 'Amenity']),
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
      } : {
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
        source: 'Purchased' as const,
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
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
          <DialogTitle>{service ? 'Editar Producto' : 'Añadir Nuevo Producto'}</DialogTitle>
          <DialogDescription>
            {service
              ? `Actualizar detalles para ${service.name}.`
              : 'Añadir un nuevo producto a su inventario.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form id="edit-service-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
                <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                    <FormItem className="space-y-3">
                    <FormLabel>Fuente del Producto</FormLabel>
                    <FormControl>
                        <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex space-x-4"
                        >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                            <RadioGroupItem value="Purchased" id="editservicedialog-radiogroupitem-1" />
                            </FormControl>
                            <FormLabel className="font-normal">Comprado</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                            <RadioGroupItem value="Internal" id="editservicedialog-radiogroupitem-2" />
                            </FormControl>
                            <FormLabel className="font-normal">Producción Interna</FormLabel>
                        </FormItem>
                        </RadioGroup>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormItem>
                <FormLabel>Imagen del Producto (Opcional)</FormLabel>
                    <div className="flex items-center gap-4">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            className="relative h-20 w-20 rounded-md p-0"
                            onClick={() => fileInputRef.current?.click()} id="editservicedialog-button-1"
                        >
                            <Avatar className="h-full w-full rounded-md">
                                <AvatarImage src={imagePreview || undefined} alt={form.getValues('name')} className="object-cover" />
                                <AvatarFallback className="rounded-md bg-transparent">
                                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                        <div className="flex flex-col gap-1 w-full">
                        <p className="text-xs text-muted-foreground">Haga clic en el recuadro para buscar una imagen.</p>
                        {imagePreview && (
                            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive h-auto p-1 justify-start w-fit" onClick={() => {
                                setImagePreview(null);
                                form.setValue('imageUrl', '');
                                if(fileInputRef.current) fileInputRef.current.value = '';
                            }} id="editservicedialog-button-eliminar-imagen">
                                Eliminar imagen
                            </Button>
                        )}
                        </div>
                    </div>
                <FormMessage />
                </FormItem>
                <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Categoría</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingCategories}>
                        <FormControl>
                            <SelectTrigger id="editservicedialog-selecttrigger-1"><SelectValue placeholder="Seleccione" /></SelectTrigger>
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
                        <FormLabel>Sub-Categoría</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingSubCategories || !selectedCategoryId}>
                        <FormControl>
                            <SelectTrigger id="editservicedialog-selecttrigger-2"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>{subCategories?.map(sc => <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </FormItem>
                    )}
                />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                    <FormItem className="col-span-2">
                        <FormLabel>Nombre del Producto</FormLabel>
                        <FormControl>
                        <Input placeholder="p.ej., Botella de Agua" {...field} id="editservicedialog-input-p-ej-botella-de" />
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
                        <FormLabel>Código</FormLabel>
                        <FormControl>
                        <Input readOnly placeholder="Auto-generado" {...field} className="bg-muted text-center font-mono" id="editservicedialog-input-auto-generado" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                </div>
                {source === 'Purchased' && <FormField
                    control={form.control}
                    name="supplierId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Proveedor (Opcional)</FormLabel>
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
                            <SelectTrigger id="editservicedialog-selecttrigger-3">
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
                <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Categoría (Contable)</FormLabel>
                    <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                    >
                        <FormControl>
                        <SelectTrigger id="editservicedialog-selecttrigger-4">
                            <SelectValue placeholder="Seleccione una categoría contable" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="Beverage">Bebida</SelectItem>
                        <SelectItem value="Food">Comida</SelectItem>
                        <SelectItem value="Amenity">Amenidad</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                              <FormLabel>Producto Activo</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                  {form.getValues('source') === 'Internal'
                                      ? 'Desactive si el producto no está disponible en cocina.'
                                      : 'Desactive para ocultar el producto de la venta.'
                                  }
                              </p>
                          </div>
                          <FormControl>
                              <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange} id="editservicedialog-switch-1"
                              />
                          </FormControl>
                      </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                {source === 'Purchased' && <FormField
                    control={form.control}
                    name="costPrice"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Precio de Costo</FormLabel>
                        <FormControl>
                        <Input
                            type="text"
                            inputMode="decimal"
                            value={costPriceInput}
                            onChange={handleCostPriceChange}
                            className="text-right" id="editservicedialog-input-1"
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
                    <FormItem>
                        <FormLabel>Precio de Venta</FormLabel>
                        <FormControl>
                        <Input
                            type="text"
                            inputMode="decimal"
                            value={priceInput}
                            onChange={handlePriceChange}
                            className="text-right" id="editservicedialog-input-2"
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
                            <FormLabel>Existencias</FormLabel>
                            <FormControl>
                            <Input type="number" {...field} className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" id="editservicedialog-input-3" />
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
                            <FormLabel>Exist. Mínimas</FormLabel>
                            <FormControl>
                            <Input type="number" {...field} placeholder="10" className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" id="editservicedialog-input-10" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>}
                <FormField
                control={form.control}
                name="taxIds"
                render={({ field }) => (
                    <FormItem>
                    <div className="flex flex-row items-center justify-between mb-2">
                        <FormLabel>Impuestos Aplicables</FormLabel>
                        <FormField
                            control={form.control}
                            name="taxIncluded"
                            render={({ field: taxIncludedField }) => (
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Impuesto incluido en precio</FormLabel>
                                    <FormControl>
                                        <Switch
                                            checked={taxIncludedField.value}
                                            onCheckedChange={taxIncludedField.onChange} id="editservicedialog-switch-tax-included"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="space-y-3 rounded-md border p-4 max-h-40 overflow-y-auto bg-muted/30">
                        {isLoadingTaxes ? (
                        <p className="text-sm text-muted-foreground">Cargando impuestos...</p>
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
                                }} id="editservicedialog-checkbox-1"
                                />
                            </FormControl>
                            <FormLabel className="font-normal">
                                {tax.name} ({tax.percentage}%)
                            </FormLabel>
                            </FormItem>
                        ))
                        ) : (
                        <p className="text-sm text-muted-foreground">No hay impuestos configurados. <Link href="/settings/taxes" className="text-primary underline" id="editservicedialog-link-crear-uno">Crear uno</Link></p>
                        )}
                    </div>
                    <FormMessage />
                    </FormItem>
                )}
                />

                {/* Price Breakdown Display */}
                {priceBreakdown && (
                    <div className="rounded-xl border bg-primary/5 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-tight flex items-center gap-2">
                                <DollarSign className="h-3 w-3" />
                                Resumen de Cálculo
                            </h4>
                            {priceBreakdown.profitMargin > 0 ? (
                                <span className="text-[10px] font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
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
                                <p className="text-sm font-mono font-bold">{formatCurrency(priceBreakdown.subtotal)}</p>
                            </div>
                            <div className="space-y-1 text-right">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Impuestos</p>
                                <p className="text-sm font-mono font-bold text-primary">+{formatCurrency(priceBreakdown.totalTaxAmount)}</p>
                            </div>
                        </div>

                        <Separator className="opacity-50" />

                        <div className="space-y-2">
                            {priceBreakdown.taxBreakdown.length > 0 && (
                                <div className="space-y-1">
                                    {priceBreakdown.taxBreakdown.map((t, idx) => (
                                        <div key={idx} className="flex justify-between text-[10px]">
                                            <span className="text-muted-foreground">{t.name} ({t.percentage}%):</span>
                                            <span className="font-mono">{formatCurrency(t.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            <div className="flex justify-between items-center py-2 px-3 bg-primary/10 rounded-lg">
                                <p className="text-xs font-black uppercase">Total Venta:</p>
                                <p className="text-lg font-black font-mono">{formatCurrency(priceBreakdown.finalPrice)}</p>
                            </div>

                            <div className="flex justify-between items-center px-3">
                                <p className="text-[11px] font-bold text-muted-foreground uppercase">Utilidad Estimada:</p>
                                <p className={`text-sm font-black font-mono ${priceBreakdown.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                    {formatCurrency(priceBreakdown.profit)}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </form>
          </Form>
        </div>

        <DialogFooter className="p-6 pt-4 border-t bg-background flex-shrink-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} id="editservicedialog-button-cancelar">Cancelar</Button>
            <Button type="submit" form="edit-service-form" disabled={isPending} id="editservicedialog-button-2">
                {isPending ? 'Guardando...' : 'Guardar Producto'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
