'use client';
import { useState, useTransition, useEffect, useMemo, useRef } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Supplier, Service, Tax } from '@/types';
import { savePurchaseInvoice } from '@/lib/actions/purchase.actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, X, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatCurrency } from '@/lib/utils';
import { es } from 'date-fns/locale';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const purchaseItemSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1."),
  costPrice: z.coerce.number().min(0, "El costo no puede ser negativo."),
  taxIds: z.array(z.string()).optional(),
});

const purchaseInvoiceSchema = z.object({
  supplierId: z.string({ required_error: "Debe seleccionar un proveedor." }),
  invoiceNumber: z.string().min(1, "El número de factura es requerido.").max(25, "El número de factura no debe exceder los 25 caracteres."),
  invoiceDate: z.date({ required_error: "La fecha es requerida." }),
  items: z.array(purchaseItemSchema).min(1, "Debe agregar al menos un producto a la factura."),
  taxesIncluded: z.boolean().default(false),
  discountType: z.enum(['percentage', 'fixed', 'none']).optional(),
  discountValue: z.coerce.number().min(0, "El descuento no puede ser negativo.").optional(),
  imageUrls: z.array(z.string()).max(5, "No puede subir más de 5 imágenes.").optional(),
});

type PurchaseInvoiceFormValues = z.infer<typeof purchaseInvoiceSchema>;

interface PurchaseInvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const stringToNumber = (numString: string): number => {
    if (!numString) return 0;
    const sanitized = numString.replace(/,/g, '');
    return parseFloat(sanitized);
};

const numberToString = (num: number): string => {
    if (isNaN(num) || num === null || num === 0) return '';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

const MAX_IMAGES = 5;

export default function PurchaseInvoiceFormDialog({ open, onOpenChange }: PurchaseInvoiceFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [invoiceDay, setInvoiceDay] = useState<string>('');
  const [invoiceMonth, setInvoiceMonth] = useState<string>('');
  const [invoiceYear, setInvoiceYear] = useState<string>('');
  const [costPriceInputs, setCostPriceInputs] = useState<string[]>([]);
  const [discountValueInput, setDiscountValueInput] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);


  const suppliersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'suppliers'), orderBy('name')) : null, [firestore]);
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersQuery);

  const servicesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'services'), orderBy('name')) : null, [firestore]);
  const { data: services, isLoading: isLoadingServices } = useCollection<Service>(servicesQuery);
  
  const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes'), orderBy('name')) : null, [firestore]);
  const { data: allTaxes, isLoading: isLoadingTaxes } = useCollection<Tax>(taxesQuery);

  const form = useForm<PurchaseInvoiceFormValues>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      supplierId: undefined,
      invoiceNumber: '',
      invoiceDate: new Date(),
      items: [],
      taxesIncluded: false,
      discountType: 'none',
      discountValue: undefined,
      imageUrls: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const selectedSupplierId = form.watch('supplierId');
  const items = form.watch('items');
  const taxesIncluded = form.watch('taxesIncluded');
  const discountType = form.watch('discountType');
  const discountValue = form.watch('discountValue');
  const imageUrls = form.watch('imageUrls', []);

  useEffect(() => {
    setCostPriceInputs(items.map(item => numberToString(item.costPrice)));
  }, [items]);
  
  useEffect(() => {
    form.setValue('discountValue', undefined);
    setDiscountValueInput('');
  }, [discountType, form]);

  const availableProducts = useMemo(() => {
    if (!services) return [];
    return services.filter(service => {
        const notInCart = !fields.some(field => field.serviceId === service.id);
        if (!notInCart) return false;
        
        // If a supplier is selected, only show products from that supplier OR products with no supplier
        if (selectedSupplierId) {
            return !service.supplierId || service.supplierId === selectedSupplierId;
        }

        // If no supplier is selected, show all products not in cart
        return true;
    });
}, [services, selectedSupplierId, fields]);
  
  const searchedProducts = useMemo(() => {
    if (!productSearch) return availableProducts;
    return availableProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [productSearch, availableProducts]);

  const { subtotal, totalDiscount, totalTax, totalAmount } = useMemo(() => {
    let grossSubtotal = 0;
    items.forEach(item => {
        const itemTotal = item.quantity * item.costPrice;
        if (taxesIncluded) {
            const itemTaxes = (item.taxIds || []).map(taxId => allTaxes?.find(t => t.id === taxId)).filter((t): t is Tax => !!t);
            const totalTaxRate = itemTaxes.reduce((sum, tax) => sum + tax.percentage, 0);
            grossSubtotal += itemTotal / (1 + totalTaxRate / 100);
        } else {
            grossSubtotal += itemTotal;
        }
    });

    let calculatedDiscount = 0;
    if (discountType === 'percentage' && discountValue) {
        calculatedDiscount = grossSubtotal * (discountValue / 100);
    } else if (discountType === 'fixed' && discountValue) {
        calculatedDiscount = discountValue;
    }
    calculatedDiscount = Math.min(grossSubtotal, calculatedDiscount);

    const subtotalAfterDiscount = grossSubtotal - calculatedDiscount;

    let calculatedTotalTax = 0;
    items.forEach(item => {
        let itemSubtotal = item.quantity * item.costPrice;
        if (taxesIncluded) {
            const itemTaxes = (item.taxIds || []).map(taxId => allTaxes?.find(t => t.id === taxId)).filter((t): t is Tax => !!t);
            const totalTaxRate = itemTaxes.reduce((sum, tax) => sum + tax.percentage, 0);
            itemSubtotal = (item.quantity * item.costPrice) / (1 + totalTaxRate / 100);
        }
        
        const itemProportion = grossSubtotal > 0 ? itemSubtotal / grossSubtotal : 0;
        const discountedItemSubtotal = subtotalAfterDiscount * itemProportion;

        const itemTaxes = (item.taxIds || []).map(taxId => allTaxes?.find(t => t.id === taxId)).filter((t): t is Tax => !!t);
        itemTaxes.forEach(tax => {
            calculatedTotalTax += discountedItemSubtotal * (tax.percentage / 100);
        });
    });

    const finalTotalAmount = subtotalAfterDiscount + calculatedTotalTax;
    
    return { 
        subtotal: grossSubtotal,
        totalDiscount: calculatedDiscount,
        totalTax: calculatedTotalTax,
        totalAmount: finalTotalAmount,
    };
  }, [items, taxesIncluded, allTaxes, discountType, discountValue]);

  useEffect(() => {
    if (!open) {
      form.reset({
        supplierId: undefined,
        invoiceNumber: '',
        invoiceDate: new Date(),
        items: [],
        taxesIncluded: false,
        discountType: 'none',
        discountValue: undefined,
        imageUrls: [],
      });
      setInvoiceDay('');
      setInvoiceMonth('');
      setInvoiceYear('');
      setDiscountValueInput('');
      
    } else {
      const today = new Date();
      form.setValue('invoiceDate', today, { shouldValidate: true });
      setInvoiceDay(String(today.getDate()));
      setInvoiceMonth(String(today.getMonth() + 1));
      setInvoiceYear(String(today.getFullYear()));
    }
  }, [open, form]);

  useEffect(() => {
    if (invoiceDay && invoiceMonth && invoiceYear) {
      const day = parseInt(invoiceDay, 10);
      const month = parseInt(invoiceMonth, 10) - 1; // JS months are 0-indexed
      const year = parseInt(invoiceYear, 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const date = new Date(year, month, day);
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
            form.setValue('invoiceDate', date, { shouldValidate: true });
            form.clearErrors('invoiceDate');
        } else {
            form.setError('invoiceDate', { type: 'manual', message: 'Fecha no válida.' });
        }
      }
    }
  }, [invoiceDay, invoiceMonth, invoiceYear, form]);

  const handleCostPriceChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    let value = e.target.value.replace(/[^\d]/g, '');

    if (value.length > 11) { // 8 for integers, 1 for dot, 2 for decimals. Total 11.
      value = value.slice(0, 11);
    }
    
    if (value === '') {
        const newCostPriceInputs = [...costPriceInputs];
        newCostPriceInputs[index] = '';
        setCostPriceInputs(newCostPriceInputs);
        form.setValue(`items.${index}.costPrice`, 0, { shouldValidate: true });
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
    
    const newInputs = [...costPriceInputs];
    newInputs[index] = formattedValue;
    setCostPriceInputs(newInputs);
    
    form.setValue(`items.${index}.costPrice`, stringToNumber(formattedValue), { shouldValidate: true });
};
  
  const handleDiscountValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const discountType = form.getValues('discountType');

    if (discountType === 'fixed') {
        let numbers = value.replace(/[^\d]/g, '');
        if (numbers === '') {
            setDiscountValueInput('');
            form.setValue('discountValue', undefined, { shouldValidate: true });
            return;
        }
        numbers = numbers.replace(/^0+/, '');
        while (numbers.length < 3) {
            numbers = '0' + numbers;
        }
        const integerPart = numbers.slice(0, numbers.length - 2);
        const decimalPart = numbers.slice(numbers.length - 2);
        const formattedInteger = new Intl.NumberFormat('en-US').format(parseInt(integerPart, 10) || 0);
        const formattedValue = `${formattedInteger}.${decimalPart}`;
        setDiscountValueInput(formattedValue);
        form.setValue('discountValue', stringToNumber(formattedValue), { shouldValidate: true });
    } else { // for 'percentage' or undefined
        const sanitizedValue = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        if (parseFloat(sanitizedValue) > 100 && discountType === 'percentage') {
            setDiscountValueInput('100');
            form.setValue('discountValue', 100, { shouldValidate: true });
        } else {
            setDiscountValueInput(sanitizedValue);
            form.setValue('discountValue', parseFloat(sanitizedValue) || 0, { shouldValidate: true });
        }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        const files = Array.from(event.target.files);
        const currentImagesCount = imageUrls.length;
        if (currentImagesCount + files.length > MAX_IMAGES) {
            toast({
                title: 'Límite de imágenes alcanzado',
                description: `Puede subir un máximo de ${MAX_IMAGES} imágenes.`,
                variant: 'destructive',
            });
            return;
        }

        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                form.setValue('imageUrls', [...form.getValues('imageUrls') || [], dataUrl], { shouldValidate: true });
            };
            reader.readAsDataURL(file);
        });
    }
    // Reset file input to allow selecting the same file again
    event.target.value = '';
  };

  const handleRemoveImage = (indexToRemove: number) => {
    form.setValue('imageUrls', imageUrls.filter((_, index) => index !== indexToRemove), { shouldValidate: true });
  };


  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => String(currentYear - i));
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i, 1).toLocaleString('es', { month: 'long' }),
  }));
  const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const days = invoiceYear && invoiceMonth ? Array.from({ length: daysInMonth(parseInt(invoiceYear, 10), parseInt(invoiceMonth, 10)) }, (_, i) => String(i + 1)) : Array.from({ length: 31 }, (_, i) => String(i + 1));

  const onSubmit = (values: PurchaseInvoiceFormValues) => {
    const supplier = suppliers?.find(s => s.id === values.supplierId);
    if (!supplier) {
        toast({ title: "Error", description: "Proveedor no válido.", variant: 'destructive' });
        return;
    }

    const payload = {
        ...values,
        supplierName: supplier.name,
        subtotal,
        totalDiscount,
        totalTax,
        totalAmount,
    };
    
    startTransition(async () => {
      const result = await savePurchaseInvoice(payload);
      if (result.error) {
        toast({ title: 'Error al registrar la compra', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '¡Éxito!', description: 'La factura de compra ha sido registrada y el inventario actualizado.' });
        onOpenChange(false);
      }
    });
  };

  const addProductToForm = (service: Service) => {
    append({
        serviceId: service.id,
        serviceName: service.name,
        quantity: 1,
        costPrice: service.costPrice || 0,
        taxIds: service.taxIds || [],
    });
    setProductSearch("");
    setProductSearchOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Registrar Factura de Compra</DialogTitle>
          <DialogDescription>
            Complete los detalles de la factura para actualizar el inventario.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 gap-4">
            <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="details">Detalles de Factura</TabsTrigger>
                    <TabsTrigger value="images">Imágenes Adjuntas ({imageUrls.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="flex-1 overflow-y-auto -mx-1 px-1 mt-4">
                    <div className="space-y-4 pr-3">
                         <div className="grid md:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="supplierId"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Proveedor</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione un proveedor" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {isLoadingSuppliers ? (
                                                    <div className="p-2 text-sm">Cargando...</div>
                                                ) : (
                                                    suppliers?.map((supplier) => (
                                                        <SelectItem key={supplier.id} value={supplier.id}>
                                                            {supplier.name}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="invoiceNumber"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Número de Factura</FormLabel>
                                    <FormControl><Input placeholder="FAC-12345" {...field} maxLength={25} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="invoiceDate"
                                render={() => (
                                    <FormItem>
                                    <FormLabel>Fecha de Factura</FormLabel>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Select onValueChange={setInvoiceDay} value={invoiceDay}>
                                        <FormControl>
                                            <SelectTrigger>
                                            <SelectValue placeholder="Día" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {days.map((d) => (
                                            <SelectItem key={d} value={d}>{d}</SelectItem>
                                            ))}
                                        </SelectContent>
                                        </Select>
                                        <Select onValueChange={setInvoiceMonth} value={invoiceMonth}>
                                            <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Mes" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                            {months.map((m) => (
                                                <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>
                                            ))}
                                            </SelectContent>
                                        </Select>
                                        <Select onValueChange={setInvoiceYear} value={invoiceYear}>
                                            <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Año" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                            {years.map((y) => (
                                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                            ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex flex-col space-y-2">
                              <div className="flex justify-between items-center">
                                <h3 className="text-sm font-medium">Artículos de la Factura</h3>
                                <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button type="button" variant="outline" size="sm" className="gap-2">
                                            <PlusCircle className="h-4 w-4" />
                                            Añadir Producto
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="end">
                                        <Command>
                                            <CommandInput placeholder="Buscar producto..." value={productSearch} onValueChange={setProductSearch} />
                                            <CommandList>
                                                <CommandEmpty>{isLoadingServices ? 'Cargando productos...' : 'No se encontraron productos.'}</CommandEmpty>
                                                <CommandGroup>
                                                    {searchedProducts.map((product) => (
                                                        <CommandItem key={product.id} onSelect={() => addProductToForm(product)}>
                                                            {product.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="border rounded-md">
                                <ScrollArea className="h-48">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-muted">
                                            <TableRow>
                                                <TableHead>Producto</TableHead>
                                                <TableHead className="w-[100px]">Cantidad</TableHead>
                                                <TableHead className="w-[150px]">Costo Unit.</TableHead>
                                                <TableHead className="w-[150px] text-right">Subtotal</TableHead>
                                                <TableHead className="w-[50px]"><span className="sr-only">Quitar</span></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {fields.map((item, index) => (
                                                <TableRow key={item.id}>
                                                    <TableCell>{item.serviceName}</TableCell>
                                                    <TableCell>
                                                        <Input
                                                          type="number"
                                                          {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                                                          onKeyDown={(e) => {
                                                              if (['-', 'e', '+', '.'].includes(e.key)) {
                                                                  e.preventDefault();
                                                              }
                                                          }}
                                                          className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                          min="1"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={costPriceInputs[index] ?? ''}
                                                            onChange={(e) => handleCostPriceChange(e, index)}
                                                            onKeyDown={(e) => {
                                                                if (['-', 'e', '+'].includes(e.key)) {
                                                                    e.preventDefault();
                                                                }
                                                            }}
                                                            className="text-right"
                                                        />
                                                        {form.formState.errors.items?.[index]?.costPrice && (
                                                            <p className="text-sm font-medium text-destructive pt-1">
                                                                {form.formState.errors.items[index]?.costPrice?.message}
                                                            </p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">{formatCurrency(items[index].quantity * items[index].costPrice)}</TableCell>
                                                    <TableCell>
                                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(index)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {fields.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Añada productos a la factura.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                            {form.formState.errors.items && <p className="text-sm font-medium text-destructive">{form.formState.errors.items.message}</p>}
                        </div>
                        <FormField
                            control={form.control}
                            name="taxesIncluded"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel>Los costos unitarios incluyen impuestos</FormLabel>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                         <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="discountType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Descuento (Opcional)</FormLabel>
                                        <Select onValueChange={(value) => {
                                            if (value === 'none') {
                                                field.onChange(undefined);
                                                form.setValue('discountValue', undefined);
                                                setDiscountValueInput('');
                                            } else {
                                                field.onChange(value as 'percentage' | 'fixed');
                                            }
                                        }} value={field.value || 'none'}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Sin descuento" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Sin descuento</SelectItem>
                                                <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                                                <SelectItem value="fixed">Monto Fijo (₡)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="discountValue"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor del Descuento</FormLabel>
                                        <FormControl>
                                            <Input
                                                type={discountType === 'fixed' ? 'text' : 'number'}
                                                inputMode={discountType === 'percentage' ? 'decimal' : 'text'}
                                                placeholder="0"
                                                disabled={!discountType || discountType === 'none'}
                                                step={discountType === 'percentage' ? '0.01' : undefined}
                                                value={discountValueInput}
                                                onChange={handleDiscountValueChange}
                                                className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="images" className="flex-1 overflow-y-auto -mx-1 px-1 mt-4">
                    <div className="space-y-2 pr-3">
                        <Label>Fotos de la Factura (Opcional)</Label>
                        <div className="grid grid-cols-5 gap-2">
                            {imageUrls.map((url, index) => (
                                <div key={index} className="relative group aspect-square">
                                    <img src={url} alt={`Factura ${index + 1}`} className="object-cover w-full h-full rounded-md border" />
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleRemoveImage(index)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            {Array.from({ length: MAX_IMAGES - imageUrls.length }).map((_, index) => (
                                <button
                                    key={`placeholder-${index}`}
                                    type="button"
                                    className="flex items-center justify-center aspect-square w-full rounded-md border-2 border-dashed text-muted-foreground hover:bg-muted/50 transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Plus className="h-6 w-6" />
                                    <span className="sr-only">Añadir imagen</span>
                                </button>
                            ))}
                        </div>
                        <Input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            multiple
                            className="hidden"
                        />
                        {form.formState.errors.imageUrls && <p className="text-sm font-medium text-destructive">{form.formState.errors.imageUrls.message}</p>}
                    </div>
                </TabsContent>
            </Tabs>
            
            <div className="space-y-1 rounded-lg border p-4">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                </div>
                 {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                        <span className="font-medium">Descuento:</span>
                        <span>-{formatCurrency(totalDiscount)}</span>
                    </div>
                )}
                 <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Impuestos:</span>
                    <span>{formatCurrency(totalTax)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>{formatCurrency(totalAmount)}</span>
                </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar Factura de Compra'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
