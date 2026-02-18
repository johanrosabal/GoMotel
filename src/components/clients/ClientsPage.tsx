'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy as fbOrderBy } from "firebase/firestore";
import type { Client } from "@/types";
import { Skeleton } from "../ui/skeleton";
import ClientsTable from "./ClientsTable";
import { Button } from "../ui/button";
import { PlusCircle } from "lucide-react";
import AddClientDialog from "./AddClientDialog";

export default function ClientsPage() {
    const { firestore } = useFirebase();

    const clientsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "clients"), fbOrderBy("createdAt", "desc"));
    }, [firestore]);

    const { data: clients, isLoading } = useCollection<Client>(clientsQuery);

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <AddClientDialog>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Añadir Cliente
                    </Button>
                </AddClientDialog>
            </div>
            {isLoading ? (
                <div className="space-y-2 rounded-md border p-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : (
                <ClientsTable clients={clients || []} />
            )}
        </div>
    );
}
