'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Supplier } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useState } from "react";
import SuppliersTable from "./SuppliersTable";
import SupplierFormDialog from "./SupplierFormDialog";

export default function SuppliersClientPage() {
    const { firestore } = useFirebase();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>(undefined);

    const suppliersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "suppliers"), orderBy("createdAt", "desc"));
    }, [firestore]);

    const { data: suppliers, isLoading } = useCollection<Supplier>(suppliersQuery);

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setIsFormOpen(true);
    };
    
    const handleAdd = () => {
        setEditingSupplier(undefined);
        setIsFormOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Proveedor
                </Button>
                <SupplierFormDialog 
                    open={isFormOpen} 
                    onOpenChange={setIsFormOpen} 
                    supplier={editingSupplier} 
                />
            </div>
            {isLoading ? (
                <div className="space-y-2 rounded-md border p-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : (
                <SuppliersTable suppliers={suppliers || []} onEdit={handleEdit} />
            )}
        </div>
    );
}
