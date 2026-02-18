'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import type { Client } from "@/types";
import { Skeleton } from "../ui/skeleton";
import ClientsTable from "./ClientsTable";
import { Button } from "../ui/button";
import { PlusCircle } from "lucide-react";
import AddClientDialog from "./AddClientDialog";
import { useMemo } from "react";

export default function ClientsPage() {
    const { firestore } = useFirebase();

    const clientsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // The composite orderBy was causing an error without a specific Firestore index.
        // Temporarily removing ordering until the index is created.
        return query(collection(firestore, "clients"));
    }, [firestore]);

    const { data: clients, isLoading } = useCollection<Client>(clientsQuery);
    
    // Sort clients manually on the client-side for now
    const sortedClients = useMemo(() => {
        if (!clients) return [];
        return [...clients].sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
    }, [clients]);

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
                <ClientsTable clients={sortedClients} />
            )}
        </div>
    );
}
