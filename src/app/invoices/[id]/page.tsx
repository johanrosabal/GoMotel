import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Invoice } from '@/types';
import PublicInvoicePage from '@/components/billing/invoices/PublicInvoicePage';
import { notFound } from 'next/navigation';

async function getInvoice(id: string): Promise<Invoice | null> {
    try {
        const invoiceDoc = await getDoc(doc(db, 'invoices', id));
        if (invoiceDoc.exists()) {
            return { id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice;
        }
        return null;
    } catch (error) {
        console.error("Error fetching invoice:", error);
        return null;
    }
}

// Helper to serialize invoice data before passing to client component
function serializeInvoice(invoice: Invoice) {
    return {
        ...invoice,
        createdAt: invoice.createdAt.toDate().toISOString(),
    };
}


export default async function PublicInvoiceRootPage({ params }: { params: { id: string } }) {
    if (!params.id) {
        notFound();
    }
    
    const invoice = await getInvoice(params.id);

    if (!invoice) {
        notFound();
    }
    
    const serializedInvoice = serializeInvoice(invoice);

    return (
        <PublicInvoicePage invoiceData={serializedInvoice} />
    );
}
