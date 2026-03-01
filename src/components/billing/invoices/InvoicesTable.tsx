'use client';

import type { Invoice } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Eye, Printer, FileDown, ReceiptText } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import InvoiceTemplate from './InvoiceTemplate';
import PosTicketTemplate from './PosTicketTemplate';

function ActionsMenu({ invoice }: { invoice: Invoice }) {
    const invoiceRef = useRef<HTMLDivElement>(null);
    const ticketRef = useRef<HTMLDivElement>(null);

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

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
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
                    <DropdownMenuItem onSelect={handleDownloadPdf}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Descargar PDF
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            
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
