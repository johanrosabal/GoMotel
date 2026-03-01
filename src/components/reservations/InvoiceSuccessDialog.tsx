'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Printer, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import React, { useRef, useState } from 'react';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Invoice } from '@/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import InvoiceTemplate from '../billing/invoices/InvoiceTemplate';
import PosTicketTemplate from '../billing/invoices/PosTicketTemplate';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    const ticketRefForPrint = useRef<HTMLDivElement>(null);
    const [showPhoneInput, setShowPhoneInput] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');

    const invoiceDocRef = useMemoFirebase(() => {
        if (!firestore || !invoiceId) return null;
        return doc(firestore, 'invoices', invoiceId);
    }, [firestore, invoiceId]);

    const { data: invoice, isLoading } = useDoc<Invoice>(invoiceDocRef);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);

        let formattedValue = '';
        if (value.length > 0) {
            formattedValue = '(' + value.slice(0, 3);
            if (value.length > 3) {
                formattedValue += ') ' + value.slice(3, 7);
            }
            if (value.length > 7) {
                formattedValue += '-' + value.slice(7);
            }
        }
        setPhoneNumber(formattedValue);
    };

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

    const handlePrintTicket = () => {
        const input = ticketRefForPrint.current;
        if (!input || !invoice) return;
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const styles = Array.from(document.styleSheets)
            .map(styleSheet => {
                try {
                    return Array.from(styleSheet.cssRules)
                        .map(rule => rule.cssText)
                        .join('');
                } catch (e) {
                    return '';
                }
            })
            .join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Ticket ${invoice.invoiceNumber}</title>
                    <style>${styles}</style>
                    <style>
                        @page { size: 80mm auto; margin: 0mm; }
                        body { margin: 0; padding: 0; background: white !important; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    </style>
                </head>
                <body>
                    ${input.innerHTML}
                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handlePrintInvoice = () => {
        const input = invoiceRefForPDF.current;
        if (!input || !invoice) return;
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const styles = Array.from(document.styleSheets)
            .map(styleSheet => {
                try {
                    return Array.from(styleSheet.cssRules)
                        .map(rule => rule.cssText)
                        .join('');
                } catch (e) {
                    return '';
                }
            })
            .join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Factura ${invoice.invoiceNumber}</title>
                    <style>${styles}</style>
                    <style>
                        @page { size: auto; margin: 0mm; }
                        body { margin: 1cm; background: white !important; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    </style>
                </head>
                <body>
                    ${input.innerHTML}
                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleShareViaWhatsApp = () => {
        if (!invoice) return;
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const publicUrl = `${window.location.origin}/invoices/${invoice.id}`;
        const whatsappMessage = encodeURIComponent(
            `¡Hola! Puedes ver y descargar tu factura #${invoice.invoiceNumber} por un monto de ${formatCurrency(invoice.total)} en el siguiente enlace: ${publicUrl}`
        );
        const whatsappUrl = cleanPhone 
            ? `https://wa.me/${cleanPhone}?text=${whatsappMessage}`
            : `https://wa.me/?text=${whatsappMessage}`;
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        setShowPhoneInput(false);
    };


    if (!invoiceId) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="items-center text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                    <DialogTitle className="text-2xl font-black">¡PAGO COMPLETADO!</DialogTitle>
                    <DialogDescription>
                        Venta finalizada exitosamente.
                    </DialogDescription>
                </DialogHeader>
                {isLoading ? <p className="text-center animate-pulse">Generando comprobante...</p> : invoice && (
                <>
                    <div className="py-6 text-center bg-muted/30 rounded-2xl border-2 border-dashed">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Comprobante N°</p>
                        <p className="text-4xl font-black font-mono tracking-tighter text-primary">{invoice.invoiceNumber.split('-')[1]}</p>
                        <div className="mt-4 px-4 space-y-1">
                            <p className="text-xs font-bold uppercase truncate">{invoice.clientName}</p>
                            <p className="text-2xl font-black text-foreground">{formatCurrency(invoice.total)}</p>
                        </div>
                    </div>

                    {showPhoneInput && (
                        <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 border-2 border-green-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                            <Label htmlFor="whatsapp-phone" className="text-[10px] font-black uppercase tracking-widest text-green-700 dark:text-green-400 ml-1">Número de WhatsApp</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="whatsapp-phone"
                                    placeholder="(506) 0000-0000" 
                                    value={phoneNumber} 
                                    onChange={handlePhoneChange}
                                    className="h-12 font-black text-lg rounded-xl border-green-500/30"
                                    autoFocus
                                />
                                <Button onClick={handleShareViaWhatsApp} className="h-12 w-12 rounded-xl bg-green-500 hover:bg-green-600 shrink-0 shadow-lg">
                                    <ChevronRight className="h-6 w-6" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Hidden div for PDF generation and Printing */}
                    <div className="absolute -left-[9999px] top-0">
                        <InvoiceTemplate invoice={invoice} ref={invoiceRefForPDF} />
                        <PosTicketTemplate invoice={invoice} ref={ticketRefForPrint} />
                    </div>
                </>
                )}
                <DialogFooter className="flex-col sm:flex-col gap-3">
                    {!showPhoneInput && (
                        <>
                            <div className="grid grid-cols-2 gap-2 w-full">
                                <Button type="button" onClick={handlePrintTicket} disabled={isLoading || !invoice} className="h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md">
                                    <Printer className="mr-2 h-4 w-4" />
                                    Imprimir Ticket
                                </Button>
                                <Button type="button" variant="outline" onClick={handlePrintInvoice} disabled={isLoading || !invoice} className="h-12 rounded-xl font-black uppercase text-[10px] tracking-widest border-2">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Factura Full
                                </Button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 w-full">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    className="h-12 rounded-xl font-black uppercase text-[10px] tracking-widest border-2 border-green-500/30 text-green-600 hover:bg-green-500 hover:text-white" 
                                    disabled={isLoading || !invoice} 
                                    onClick={() => setShowPhoneInput(true)}
                                >
                                    <WhatsAppIcon className="mr-2 h-4 w-4 fill-current" />
                                    Enviar WhatsApp
                                </Button>
                                <Button type="button" variant="ghost" onClick={handleDownloadPdf} disabled={isLoading || !invoice} className="h-12 rounded-xl font-bold text-[10px] uppercase text-muted-foreground">
                                    <Download className="mr-2 h-4 w-4" />
                                    Bajar PDF
                                </Button>
                            </div>
                        </>
                    )}
                    {showPhoneInput && (
                        <Button variant="ghost" size="sm" onClick={() => setShowPhoneInput(false)} className="w-full font-bold">
                            Cancelar y volver
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
