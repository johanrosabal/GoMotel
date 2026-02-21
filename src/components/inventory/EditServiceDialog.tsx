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
import { Image as ImageIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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

  const taxesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'taxes'), orderBy('name')) : null, [firestore]);
  const { data: taxes, isLoading: isLoadingTaxes } = useCollection<Tax>(taxesQuery);
  
  const suppliersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'suppliers'), orderBy('name')) : null, [firestore]);
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersQuery);

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
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
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
                                <RadioGroupItem value="Purchased" />
                                </FormControl>
                                <FormLabel className="font-normal">Comprado</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                <RadioGroupItem value="Internal" />
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
                                onClick={() => fileInputRef.current?.click()}
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
                                }}>
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
                                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
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
                                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
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
                            <Input placeholder="p.ej., Botella de Agua" {...field} />
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
                            <Input readOnly placeholder="Auto-generado" {...field} className="bg-muted text-center font-mono" />
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
                                <SelectTrigger>
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
                            <SelectTrigger>
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
                                        Desactive para ocultar el producto de la venta.
                                    </p>
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
                                className="text-right"
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
                                className="text-right"
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
                                <Input type="number" {...field} className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
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
                                <Input type="number" {...field} placeholder="10" className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
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
                        <FormLabel>Impuestos Aplicables</FormLabel>
                        <div className="space-y-3 rounded-md border p-4 max-h-40 overflow-y-auto">
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
                                    }}
                                    />
                                </FormControl>
                                <FormLabel className="font-normal">
                                    {tax.name} ({tax.percentage}%)
                                </FormLabel>
                                </FormItem>
                            ))
                            ) : (
                            <p className="text-sm text-muted-foreground">No hay impuestos configurados. <Link href="/settings/taxes" className="text-primary underline">Crear uno</Link></p>
                            )}
                        </div>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
              </form>
            </Form>
        </div>

        <DialogFooter className="p-6 pt-4 border-t bg-background sticky bottom-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" form="edit-service-form" disabled={isPending}>
            {isPending ? 'Guardando...' : 'Guardar Producto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
