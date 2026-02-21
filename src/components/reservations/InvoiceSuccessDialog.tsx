'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import React, { useRef } from 'react';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Invoice } from '@/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import InvoiceTemplate from '../billing/invoices/InvoiceTemplate';

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 32 32" {...props}><path d=" M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.46-1.825-2.13-2.3-2.592-.19-.18-.38-.25-.57-.25-.19 0-.38.03-.57.07-.19.04-.46.13-.72.33-.26.19-.51.42-.68.61-.17.19-.34.4-.44.58-.1.18-.19.38-.19.57 0 .19.03.38.07.57.04.19.13.46.33.72.19.26.42.51.61.68.19.17.38.34.58.44.18.1.38.19.57.19h.005c.19.03.38.07.57.11.19.04.46.13.72.33.26.19.51.42.68.61.17.19.34.38.44.57.1.18.19.38.19.57a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.46-1.825-2.13-2.3-2.592-.19-.18-.38-.25-.57-.25s-.38.03-.57.07c-.19.04-.46.13-.72.33-.26.19-.51.42-.68.61-.17.19-.34.4-.44.58-.1.18-.19.38-.19.57 0 .19.03.38.07.57.04.19.13.46.33.72.19.26.42.51.61.68.19.17.38.34.58.44.18.1.38.19.57.19.19.03.38.07.57.11.19.04.46.13.72.33.26.19.51.42.68.61.17.19.34.38.44.57.1.18.19.38.19.57.01.19-.03.38-.07.57-.04.19-.13.46-.33.72-.19.26-.42.51-.61.68-.19.17-.38.34-.58.44-.18.1-.38.19-.57.19a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.46-1.825-2.13-2.3-2.592-.19-.18-.38-.25-.57-.25s-.38.03-.57.07c-.19.04-.46.13-.72.33-.26.19-.51.42-.68.61-.17.19-.34.4-.44.58-.1.18-.19.38-.19.57z" fill="currentColor"></path></svg>
);


interface InvoiceSuccessDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoiceId: string | null;
}

export default function InvoiceSuccessDialog({ open, onOpenChange, invoiceId }: InvoiceSuccessDialogProps) {
    const { firestore } = useFirebase();
    const invoiceRefForPDF = useRef<HTMLDivElement>(null);

    const invoiceDocRef = useMemoFirebase(() => {
        if (!firestore || !invoiceId) return null;
        return doc(firestore, 'invoices', invoiceId);
    }, [firestore, invoiceId]);

    const { data: invoice, isLoading } = useDoc<Invoice>(invoiceDocRef);

    const handleDownloadPdf = () => {
        const input = invoiceRefForPDF.current;
        if (!input || !invoice) return;

        html2canvas(input, { scale: 2 }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`factura-${invoice.invoiceNumber}.pdf`);
        });
    };

    const handleShareViaWhatsApp = () => {
        if (!invoice) return;

        // 1. Download the PDF to the local machine
        handleDownloadPdf();

        // 2. Prepare a message for the user to send, instructing them to attach the downloaded file.
        const whatsappMessage = encodeURIComponent(
            `¡Hola! A continuación te adjunto el comprobante de tu factura #${invoice.invoiceNumber} por un monto de ${formatCurrency(invoice.total)}. ¡Gracias por tu preferencia!`
        );
        const whatsappUrl = `https://wa.me/?text=${whatsappMessage}`;
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    };


    if (!invoiceId || (!invoice && !isLoading)) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader className="items-center text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                    <DialogTitle className="text-2xl">¡Pago Exitoso!</DialogTitle>
                    <DialogDescription>
                        La factura se ha generado correctamente.
                    </DialogDescription>
                </DialogHeader>
                {isLoading ? <p className="text-center">Cargando factura...</p> : invoice && (
                <>
                    <div className="py-4 text-center">
                        <p className="text-sm text-muted-foreground">Factura No.</p>
                        <p className="text-3xl font-bold font-mono tracking-wider">{invoice.invoiceNumber}</p>
                        <div className="mt-4 text-sm">
                            <p><strong>Cliente:</strong> {invoice.clientName}</p>
                            <p><strong>Total Pagado:</strong> {formatCurrency(invoice.total)}</p>
                        </div>
                    </div>
                    {/* Hidden div for PDF generation */}
                    <div className="absolute -left-[9999px] top-0">
                        <InvoiceTemplate invoice={invoice} ref={invoiceRefForPDF} />
                    </div>
                </>
                )}
                <DialogFooter className="flex-col sm:flex-row sm:justify-center gap-2">
                    <Button type="button" onClick={handleDownloadPdf} disabled={isLoading || !invoice}>
                        <Download className="mr-2 h-4 w-4" />
                        Descargar PDF
                    </Button>
                    <Button type="button" variant="outline" className="bg-green-500 text-white hover:bg-green-600 hover:text-white" disabled={isLoading || !invoice} onClick={handleShareViaWhatsApp}>
                       <WhatsAppIcon className="mr-2 h-4 w-4 fill-current" />
                        Compartir por WhatsApp
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
