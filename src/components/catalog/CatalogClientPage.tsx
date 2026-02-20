'use client';
import { useState } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { ProductCategory, ProductSubCategory, Service } from '@/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import CategoryFormDialog from './CategoryFormDialog';
import SubCategoryFormDialog from './SubCategoryFormDialog';
import { deleteCategory } from '@/lib/actions/catalog.actions';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import EditServiceDialog from '@/components/inventory/EditServiceDialog';

function DeleteAction({ id, name, type, onDelete, children }: { id: string, name: string, type: string, onDelete: (id: string) => Promise<any>, children: React.ReactNode }) {
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Está seguro de eliminar?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción no se puede deshacer. Esto eliminará permanentemente la {type} "{name}".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default function CatalogClientPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
    const [selectedSubCategory, setSelectedSubCategory] = useState<ProductSubCategory | null>(null);

    // Dialog states
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ProductCategory | undefined>(undefined);
    const [subCategoryDialogOpen, setSubCategoryDialogOpen] = useState(false);
    const [editingSubCategory, setEditingSubCategory] = useState<ProductSubCategory | undefined>(undefined);
    const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | undefined>(undefined);

    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<ProductCategory>(categoriesQuery);

    const subCategoriesQuery = useMemoFirebase(() => {
        if (!firestore || !selectedCategory) return null;
        return query(collection(firestore, 'productSubCategories'), where('categoryId', '==', selectedCategory.id), orderBy('name'));
    }, [firestore, selectedCategory]);
    const { data: subCategories, isLoading: isLoadingSubCategories } = useCollection<ProductSubCategory>(subCategoriesQuery);

    const servicesQuery = useMemoFirebase(() => {
        if (!firestore || !selectedSubCategory) return null;
        return query(collection(firestore, 'services'), where('subCategoryId', '==', selectedSubCategory.id), orderBy('name'));
    }, [firestore, selectedSubCategory]);
    const { data: services, isLoading: isLoadingServices } = useCollection<Service>(servicesQuery);

    const handleSelectCategory = (category: ProductCategory) => {
        setSelectedCategory(category);
        setSelectedSubCategory(null);
    }
    
    const handleDeleteCategory = async (id: string) => {
        // TODO: Check if category has subcategories before deleting
        await deleteCategory(id);
        toast({ title: "Categoría eliminada" });
        if (selectedCategory?.id === id) {
            setSelectedCategory(null);
        }
    }

    return (
        <div className="grid md:grid-cols-3 gap-6">
            {/* Categories Column */}
            <div className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">Categorías</h3>
                    <Button size="sm" onClick={() => { setEditingCategory(undefined); setCategoryDialogOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Añadir
                    </Button>
                </div>
                <ScrollArea className="h-96">
                    {isLoadingCategories ? <Skeleton className="h-full w-full" /> : (
                        <div className="space-y-2 pr-4">
                            {categories?.map(cat => (
                                <div key={cat.id} onClick={() => handleSelectCategory(cat)} className={cn("p-2 rounded-md cursor-pointer group", selectedCategory?.id === cat.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium">{cat.name}</span>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {e.stopPropagation(); setEditingCategory(cat); setCategoryDialogOpen(true);}}><Edit className="h-4 w-4"/></Button>
                                            <DeleteAction id={cat.id} name={cat.name} type="categoría" onDelete={handleDeleteCategory}>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}><Trash2 className="h-4 w-4"/></Button>
                                            </DeleteAction>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Sub-Categories Column */}
            <div className="border rounded-lg p-4">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">Sub-Categorías</h3>
                    <Button size="sm" disabled={!selectedCategory} onClick={() => { setEditingSubCategory(undefined); setSubCategoryDialogOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Añadir
                    </Button>
                </div>
                <ScrollArea className="h-96">
                    {!selectedCategory ? <div className="text-center text-muted-foreground pt-16">Seleccione una categoría</div> :
                     isLoadingSubCategories ? <Skeleton className="h-full w-full" /> : (
                        <div className="space-y-2 pr-4">
                             {subCategories?.map(sub => (
                                <div key={sub.id} onClick={() => setSelectedSubCategory(sub)} className={cn("p-2 rounded-md cursor-pointer group", selectedSubCategory?.id === sub.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent')}>
                                   <div className="flex justify-between items-center">
                                        <span className="font-medium">{sub.name}</span>
                                        {/* Actions here */}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Products Column */}
            <div className="border rounded-lg p-4">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">Productos</h3>
                    <Button size="sm" disabled={!selectedSubCategory} onClick={() => { setEditingService(undefined); setServiceDialogOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Añadir
                    </Button>
                </div>
                 <ScrollArea className="h-96">
                    {!selectedSubCategory ? <div className="text-center text-muted-foreground pt-16">Seleccione una subcategoría</div> :
                     isLoadingServices ? <Skeleton className="h-full w-full" /> : (
                        <div className="space-y-2 pr-4">
                             {services?.map(srv => (
                                <div key={srv.id} className="p-2 rounded-md hover:bg-muted group">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium">{srv.name}</span>
                                        {/* Actions here */}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Dialogs */}
            <CategoryFormDialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen} category={editingCategory} />
            {selectedCategory && <SubCategoryFormDialog open={subCategoryDialogOpen} onOpenChange={setSubCategoryDialogOpen} categoryId={selectedCategory.id} subCategory={editingSubCategory} />}
            {selectedCategory && selectedSubCategory && <EditServiceDialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen} service={editingService} allServices={services || []} categoryId={selectedCategory.id} subCategoryId={selectedSubCategory.id} />}
        </div>
    );
}
