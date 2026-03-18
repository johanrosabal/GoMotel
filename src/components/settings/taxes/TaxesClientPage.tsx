'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Tax } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import TaxesTable from "./TaxesTable";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import TaxFormDialog from "./TaxFormDialog";
import { useState } from "react";

export default function TaxesClientPage() {
    const { firestore } = useFirebase();
    const [isFormOpen, setIsFormOpen] = useState(false);

    const taxesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "taxes"), orderBy("name"));
    }, [firestore]);

    const { data: taxes, isLoading } = useCollection<Tax>(taxesQuery);

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => setIsFormOpen(true)} id="taxesclientpage-button-a-adir-impuesto">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Impuesto
                </Button>
                <TaxFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} />
            </div>
            {isLoading ? (
                <div className="space-y-2 rounded-md border p-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : (
                <TaxesTable taxes={taxes || []} />
            )}
        </div>
    );
}
