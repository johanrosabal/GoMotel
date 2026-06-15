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
                <Button 
                    onClick={handleAdd} 
                    id="suppliersclientpage-button-a-adir-proveedor" 
                    data-testid="suppliersclientpage-add-button"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 px-6 font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 transition-all active:scale-95 gap-2"
                >
                    <PlusCircle className="h-4 w-4" />
                    Añadir Proveedor
                </Button>
                <SupplierFormDialog 
                    open={isFormOpen} 
                    onOpenChange={setIsFormOpen} 
                    supplier={editingSupplier} 
                />
            </div>
            {isLoading ? (
                <div className="space-y-3 bg-slate-900/20 p-6 rounded-2xl border border-white/5">
                    <Skeleton className="h-12 w-full bg-white/5 rounded-xl" />
                    <Skeleton className="h-12 w-full bg-white/5 rounded-xl" />
                    <Skeleton className="h-12 w-full bg-white/5 rounded-xl" />
                </div>
            ) : (
                <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl shadow-black/40 overflow-hidden">
                    <SuppliersTable suppliers={suppliers || []} onEdit={handleEdit} />
                </div>
            )}
        </div>
    );
}
