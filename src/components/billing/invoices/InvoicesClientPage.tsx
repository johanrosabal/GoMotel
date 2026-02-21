'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Invoice } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import InvoicesTable from "./InvoicesTable";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";

export default function InvoicesClientPage() {
    const { firestore } = useFirebase();
    const [searchTerm, setSearchTerm] = useState('');

    const invoicesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "invoices"), orderBy("createdAt", "desc"));
    }, [firestore]);

    const { data: invoices, isLoading } = useCollection<Invoice>(invoicesQuery);

    const filteredInvoices = useMemo(() => {
        if (!invoices) return [];
        return invoices.filter(invoice => {
            const searchContent = `${invoice.clientName} ${invoice.invoiceNumber}`.toLowerCase();
            return searchContent.includes(searchTerm.toLowerCase());
        });
    }, [invoices, searchTerm]);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Input
                    placeholder="Buscar por cliente o N° de factura..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
            </div>
            {isLoading ? (
                <div className="space-y-2 rounded-md border p-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : (
                <InvoicesTable invoices={filteredInvoices} />
            )}
        </div>
    );
}

    