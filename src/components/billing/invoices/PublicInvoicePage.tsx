'use client';

import React, { useRef } from 'react';
import type { Invoice } from '@/types';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import InvoiceTemplate from './InvoiceTemplate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// The props we receive from the server component
interface SerializedInvoiceData extends Omit<Invoice, 'createdAt'> {
    createdAt: string;
}

export default function PublicInvoicePage({ invoiceData }: { invoiceData: SerializedInvoiceData }) {
    const invoiceRefForPDF = useRef<HTMLDivElement>(null);
    
    // Create a compatible invoice object for InvoiceTemplate which expects to call .toDate()
    const compatibleInvoice = {
        ...invoiceData,
        createdAt: {
            toDate: () => new Date(invoiceData.createdAt)
        }
    } as unknown as Invoice; // Cast to make it compatible

    const handleDownloadPdf = () => {
        const input = invoiceRefForPDF.current;
        if (!input || !compatibleInvoice) return;

        html2canvas(input, { scale: 2 }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`factura-${compatibleInvoice.invoiceNumber}.pdf`);
        });
    };

    return (
        <div className="bg-muted min-h-screen py-8 md:py-12">
            <div className="container max-w-4xl">
                <Card>
                    <CardHeader className="text-center px-4 md:px-6">
                        <CardTitle className="text-2xl md:text-3xl">Comprobante de Pago</CardTitle>
                        <CardDescription>
                            Gracias por su preferencia. Aquí está el resumen de su factura.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-2 sm:px-4 md:px-6">
                        <div className="flex justify-center my-6">
                            <Button onClick={handleDownloadPdf}>
                                <Download className="mr-2 h-4 w-4" />
                                Descargar Factura en PDF
                            </Button>
                        </div>
                        
                        {/* The template is used both for display and for PDF generation */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none md:hidden"></div>
                            <div className="max-h-[60vh] overflow-y-auto md:max-h-none md:overflow-visible shadow-lg md:shadow-none">
                               <InvoiceTemplate invoice={compatibleInvoice} ref={invoiceRefForPDF} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
