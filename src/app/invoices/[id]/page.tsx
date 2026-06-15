'use client';

import { useState, useEffect, use } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import PublicInvoicePage from '@/components/billing/invoices/PublicInvoicePage';
import { notFound } from 'next/navigation';

export default function PublicInvoiceRootPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [invoice, setInvoice] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        const fetchInvoice = async () => {
            try {
                const invoiceDoc = await getDoc(doc(db, 'invoices', id));
                if (invoiceDoc.exists()) {
                    const data = invoiceDoc.data();
                    setInvoice({
                        id: invoiceDoc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
                    });
                } else {
                    setInvoice(null);
                }
            } catch (error) {
                console.error("Error fetching invoice:", error);
                setInvoice(null);
            } finally {
                setLoading(false);
            }
        };

        fetchInvoice();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cargando Factura...</p>
                </div>
            </div>
        );
    }

    if (!invoice) {
        notFound();
    }

    return (
        <PublicInvoicePage invoiceData={invoice} />
    );
}
