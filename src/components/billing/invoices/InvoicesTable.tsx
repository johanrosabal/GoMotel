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
    ReceiptText, ChevronRight, X, Mail, Loader2, CheckCircle2
} from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import InvoiceTemplate from './InvoiceTemplate';
import PosTicketTemplate from './PosTicketTemplate';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendInvoiceEmail } from '@/lib/actions/email-sender.actions';
import { getClient } from '@/lib/actions/client.actions';
import { useToast } from '@/hooks/use-toast';

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 32 32" {...props}><path d=" M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.46-1.825-2.13-2.3-2.592-.19-.18-.38-.25-.57-.25-.19 0-.38.03-.57.07-.19.04-.46.13-.72.33-.26.19-.51.42-.68.61-.17.19-.34.4-.44.58-.1.18-.19.38-.19.57 0 .19.03.38.07.57.04.19.13.46.33.72.19.26.42.51.61.68.19.17.38.34.58.44.18.1.38.19.57.19h.005c.19.03.38.07.57.11.19.04.46.13.72.33.26.19.51.42.68.61.17.19.34.38.44.57.1.18.19.38.19.57a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.46-1.825-2.13-2.3-2.592-.19-.18-.38-.25-.57-.25s-.38.03-.57.07c-.19.04-.46.13-.72.33-.26.19-.51.42-.68.61-.17.19-.34.4-.44.58-.1.18-.19.38-.19.57 0 .19.03.38.07.57.04.19.13.46.33.72.19.26.42.51.61.68.19.17.38.34.58.44.18.1.38.19.57.19.19.03.38.07.57.11.19.04.46.13.72.33.26.19.51.42.68.61.17.19.34.38.44.57.1.18.19.38.19.57.01.19-.03.38-.07.57-.04.19-.13.46-.33.72-.19.26-.42.51-.61.68-.19.17-.38.34-.58.44-.18.1-.38.19-.57.19a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.46-1.825-2.13-2.3-2.592-.19-.18-.38-.25-.57-.25s-.38.03-.57.07c-.19.04-.46.13-.72.33-.26.19-.51.42-.68.61-.17.19-.34.4-.44.58-.1.18-.19.38-.19.57z" fill="currentColor"></path></svg>
);

function ActionsMenu({ invoice }: { invoice: Invoice }) {
    const invoiceRef = useRef<HTMLDivElement>(null);
    const ticketRef = useRef<HTMLDivElement>(null);
    const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
    const [showEmailDialog, setShowEmailDialog] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [emailAddress, setEmailAddress] = useState('');
    const [isFetchingEmail, setIsFetchingEmail] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (showEmailDialog && invoice.clientId) {
            const fetchClientEmail = async () => {
                setIsFetchingEmail(true);
                try {
                    const client = await getClient(invoice.clientId!);
                    if (client?.email) {
                        setEmailAddress(client.email);
                    }
                } catch (error) {
                    console.error("Error fetching client email:", error);
                } finally {
                    setIsFetchingEmail(false);
                }
            };
            fetchClientEmail();
        }
        if (!showEmailDialog) {
            setEmailSent(false);
        }
    }, [showEmailDialog, invoice.clientId]);

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

    const handleSendEmail = async () => {
        if (!emailAddress || !emailAddress.includes('@')) {
            toast({ title: 'Error', description: 'Por favor ingrese un correo válido.', variant: 'destructive' });
            return;
        }

        setIsSendingEmail(true);
        try {
            await sendInvoiceEmail(emailAddress, invoice.id);
            setEmailSent(true);
            toast({ title: '¡Éxito!', description: `Factura enviada correctamente a ${emailAddress}` });
            setTimeout(() => {
                setShowEmailDialog(false);
            }, 2000);
        } catch (error: any) {
            toast({ 
                title: 'Error al enviar', 
                description: error.message || 'No se pudo enviar el correo.', 
                variant: 'destructive' 
            });
        } finally {
            setIsSendingEmail(false);
        }
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
                    <DropdownMenuItem onSelect={() => setShowEmailDialog(true)}>
                        <Mail className="mr-2 h-4 w-4 text-blue-500" />
                        Enviar por Correo
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
                                className="h-12 font-black text-lg rounded-xl border-green-500/30 text-white"
                                autoFocus
                            />
                            <Button onClick={handleShareViaWhatsApp} className="h-12 w-12 rounded-xl bg-green-500 hover:bg-green-600 shrink-0 shadow-lg" id="invoicestable-button-share">
                                <ChevronRight className="h-6 w-6 text-white" />
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog para Enviar Email */}
            <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                             <Mail className="h-5 w-5 text-blue-500" />
                             Enviar Factura por Correo
                        </DialogTitle>
                        <DialogDescription>
                            {emailSent 
                                ? "La factura ha sido enviada con éxito."
                                : "Confirme o ingrese la dirección de correo electrónico del cliente."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        {emailSent ? (
                            <div className="flex flex-col items-center justify-center py-6 space-y-4 animate-in zoom-in-95">
                                <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                                </div>
                                <p className="text-sm font-bold text-green-500 uppercase tracking-widest">¡Enviado con éxito!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <Label htmlFor="email-address-table" className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Correo Electrónico</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input 
                                            id="email-address-table"
                                            type="email"
                                            placeholder="ejemplo@correo.com" 
                                            value={emailAddress} 
                                            onChange={(e) => setEmailAddress(e.target.value)}
                                            className="h-12 font-bold rounded-xl border-blue-500/30 pl-4 text-white"
                                            disabled={isSendingEmail}
                                            autoFocus
                                        />
                                        {isFetchingEmail && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <Button 
                                        onClick={handleSendEmail} 
                                        disabled={isSendingEmail || !emailAddress}
                                        className="h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold uppercase tracking-widest text-xs" 
                                        id="invoicestable-button-send-email"
                                    >
                                        {isSendingEmail ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            "Enviar"
                                        )}
                                    </Button>
                                </div>
                                {isFetchingEmail && <p className="text-[10px] italic text-muted-foreground animate-pulse">Buscando correo del cliente...</p>}
                            </div>
                        )}
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
