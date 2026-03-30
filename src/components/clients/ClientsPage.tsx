'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import type { Client } from "@/types";
import ClientsTable from "./ClientsTable";
import AddClientDialog from "./AddClientDialog";
import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

export default function ClientsPage() {
    const { firestore } = useFirebase();

    const clientsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // The composite orderBy was causing an error without a specific Firestore index.
        // Temporarily removing ordering until the index is created.
        return query(collection(firestore, "clients"));
    }, [firestore]);

    const { data: clients, isLoading } = useCollection<Client>(clientsQuery);
    
    const [searchTerm, setSearchTerm] = useState('');
    
    // Sort clients manually on the client-side for now
    const sortedClients = useMemo(() => {
        if (!clients) return [];
        return [...clients].sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
    }, [clients]);

    return (
        <div className="space-y-12">
            {/* Interaction Bar */}
            <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 rounded-[2.5rem] shadow-2xl shadow-black/50">
                <div className="relative w-full md:max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                    <Input 
                        placeholder="Buscar por nombre, correo o cédula..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-14 bg-white/5 border-white/10 rounded-2xl pl-12 pr-4 focus:ring-primary/20 focus:border-primary/50 transition-all font-bold uppercase tracking-wider text-[10px] placeholder:text-slate-600 italic text-white"
                    />
                </div>
                
                <AddClientDialog>
                    <Button className="h-14 px-8 bg-white text-black hover:bg-primary hover:text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.05] active:scale-95 flex items-center gap-3">
                        <UserPlus className="h-5 w-5" />
                        Registrar Huésped
                    </Button>
                </AddClientDialog>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-64 rounded-[2.5rem] bg-white/5 animate-pulse border border-white/10" />
                    ))}
                </div>
            ) : (
                <ClientsTable clients={sortedClients} searchTerm={searchTerm} />
            )}
        </div>
    );
}
