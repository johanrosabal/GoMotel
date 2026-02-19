'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Stay } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import StaysTable from "./StaysTable";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StatusFilter = 'all' | 'active' | 'completed';

export default function StaysReportPage() {
    const { firestore } = useFirebase();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    const staysQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "stays"), orderBy("checkIn", "desc"));
    }, [firestore]);

    const { data: stays, isLoading } = useCollection<Stay>(staysQuery);

    const filteredStays = useMemo(() => {
        if (!stays) return [];
        return stays.filter(stay => {
            const searchContent = `${stay.guestName} ${stay.roomNumber}`.toLowerCase();
            const searchMatch = searchContent.includes(searchTerm.toLowerCase());

            let statusMatch = true;
            if (statusFilter === 'active') {
                statusMatch = !stay.checkOut;
            } else if (statusFilter === 'completed') {
                statusMatch = !!stay.checkOut;
            }

            return searchMatch && statusMatch;
        });
    }, [stays, searchTerm, statusFilter]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-start sm:items-center gap-4">
                 <div className="flex items-center gap-2">
                    <Input
                        placeholder="Buscar por huésped o habitación..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-xs"
                    />
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Filtrar por estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los Estados</SelectItem>
                            <SelectItem value="active">Activas</SelectItem>
                            <SelectItem value="completed">Completadas</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            {isLoading ? (
                <div className="space-y-2 rounded-md border p-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : (
                <StaysTable stays={filteredStays} />
            )}
        </div>
    );
}
