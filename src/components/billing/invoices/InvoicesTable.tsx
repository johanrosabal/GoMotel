'use client';

import type { Invoice } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
    MoreHorizontal, Eye, Printer, FileDown, 
    ReceiptText, ChevronRight, X
} from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import InvoiceTemplate from './InvoiceTemplate';
import PosTicketTemplate from './PosTicketTemplate';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 32 32" {...props}><path d=" M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.46-1.825-2.13-2.3-2.592-.19-.18-.38-.25-.57-.25-.19 0-.38.03-.57.07-.19.04-.46.13-.72.33-.26.19-.51.42-.68.61-.17.19-.34.4-.44.58-.1.18-.19.38-.19.57 0 .19.03.38.07.57.04.19.13.46.33.72.19.26.42.51.61.68.19.17.38.34.58.44.18.1.38.19.57.19h.005c.19.03.38.07.57.11.19.04.46.13.72.33.26.19.51.42.68.61.17.19.34.38.44.57.1.18.19.38.19.57a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.46-1.825-2.13-2.3-2.592-.19-.18-.38-.25-.57-.25s-.38.03-.57.07c-.19.04-.46.13-.72.33-.26.19-.51.42-.68.61-.17.19-.34.4-.44.58-.1.18-.19.38-.19.57 0 .19.03.38.07.57.04.19.13.46.33.72.19.26.42.51.61.68.19.17.38.34.58.44.18.1.38.19.57.19.19.03.38.07.57.11.19.04.46.13.72.33.26.19.51.42.68.61.17.19.34.38.44.57.1.18.19.38.19.57.01.19-.03.38-.07.57-.04.19-.13.46-.33.72-.19.26-.42.51-.61.68-.19.17-.38.34-.58.44-.18.1-.38.19-.57.19a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.46-1.825-2.13-2.3-2.592-.19-.18-.38-.25-.57-.25s-.38.03-.57.07c-.19.04-.46.13-.72.33-.26.19-.51.42-.68.61-.17.19-.34.4-.44.58-.1.18-.19.38-.19.57z" fill="currentColor"></path></svg>
);

function ActionsMenu({ invoice }: { invoice: Invoice }) {
    const invoiceRef = useRef<HTMLDivElement>(null);
    const ticketRef = useRef<HTMLDivElement>(null);
    const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');

    const handlePrintInvoice = () => {
        const input = invoiceRef.current;
        if (!input) return;
        
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

    const handlePrintTicket = () => {
        const input = ticketRef.current;
        if (!input) return;
        
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

    const handleDownloadPdf = () => {
        const input = invoiceRef.current;
        if (!input) return;

        html2canvas(input, { scale: 2 }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`factura-${invoice.invoiceNumber}.pdf`);
        });
    };

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
        setShowWhatsAppDialog(false);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" id="invoicestable-button-1"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones de Impresión</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={handlePrintTicket}>
                        <ReceiptText className="mr-2 h-4 w-4" />
                        Imprimir Ticket (POS)
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handlePrintInvoice}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir Factura (Full)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setShowWhatsAppDialog(true)}>
                        <WhatsAppIcon className="mr-2 h-4 w-4 fill-current text-green-600" />
                        Enviar WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleDownloadPdf}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Descargar PDF
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Dialog para captura de teléfono */}
            <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                             <WhatsAppIcon className="h-5 w-5 fill-current text-green-600" />
                             Enviar Factura por WhatsApp
                        </DialogTitle>
                        <DialogDescription>
                            Ingrese el número de teléfono del cliente para enviar el enlace de la factura.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                        <Label htmlFor="whatsapp-phone-table" className="text-[10px] font-black uppercase tracking-widest text-green-700 dark:text-green-400">Número de WhatsApp</Label>
                        <div className="flex gap-2">
                            <Input 
                                id="whatsapp-phone-table"
                                placeholder="(506) 0000-0000" 
                                value={phoneNumber} 
                                onChange={handlePhoneChange}
                                className="h-12 font-black text-lg rounded-xl border-green-500/30"
                                autoFocus
                            />
                            <Button onClick={handleShareViaWhatsApp} className="h-12 w-12 rounded-xl bg-green-500 hover:bg-green-600 shrink-0 shadow-lg" id="invoicestable-button-share">
                                <ChevronRight className="h-6 w-6" />
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            
            {/* Templates ocultos para generación de PDF/Impresión */}
            <div className="absolute -left-[9999px] top-0 pointer-events-none">
                <InvoiceTemplate invoice={invoice} ref={invoiceRef} />
                <PosTicketTemplate invoice={invoice} ref={ticketRef} />
            </div>
        </>
    );
}

export default function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
    if (invoices.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                No se encontraron facturas.
            </div>
        );
    }
    
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Factura</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                            <TableCell className="font-mono">
                                <Badge variant="outline">{invoice.invoiceNumber}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{invoice.clientName}</TableCell>
                            <TableCell>{format(invoice.createdAt.toDate(), "dd MMM yyyy", { locale: es })}</TableCell>
                            <TableCell>{formatCurrency(invoice.total)}</TableCell>
                            <TableCell>
                                <Badge variant={invoice.status === 'Pagada' ? 'default' : 'secondary'} className={cn(invoice.status === 'Pagada' && 'bg-green-600')}>{invoice.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <ActionsMenu invoice={invoice} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
