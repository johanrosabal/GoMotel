'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Printer, FileText, ChevronRight, Share2 } from 'lucide-react';
import { formatCurrency, getBaseUrl } from '@/lib/utils';
import React, { useRef, useState } from 'react';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { Invoice, Client } from '@/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import InvoiceTemplate from '../billing/invoices/InvoiceTemplate';
import PosTicketTemplate from '../billing/invoices/PosTicketTemplate';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendInvoiceEmail } from '@/lib/actions/email-sender.actions';

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
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [emailAddress, setEmailAddress] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const { toast } = useToast();

    const invoiceDocRef = useMemoFirebase(() => {
        if (!firestore || !invoiceId) return null;
        return doc(firestore, 'invoices', invoiceId);
    }, [firestore, invoiceId]);

    const { data: invoice, isLoading } = useDoc<Invoice>(invoiceDocRef);

    // Auto-fill contact info if client has it
    React.useEffect(() => {
        const fetchClientInfo = async () => {
            if (invoice?.clientId && firestore) {
                try {
                    const clientRef = doc(firestore, 'clients', invoice.clientId);
                    const clientSnap = await getDoc(clientRef);
                    if (clientSnap.exists()) {
                        const clientData = clientSnap.data() as Client;

                        // Auto-fill email
                        if (clientData.email) {
                            setEmailAddress(clientData.email);
                        }

                        // Auto-fill phone
                        const phoneToUse = clientData.whatsappNumber || clientData.phoneNumber;
                        if (phoneToUse) {
                            // Extract digits and apply formatting
                            const digits = phoneToUse.replace(/\D/g, '');
                            if (digits.length >= 8) {
                                // Basic formatting for (506) XXXX-XXXX or similar
                                let formatted = '';
                                const mainDigits = digits.length > 8 ? digits.slice(-8) : digits;
                                const areaCode = digits.length > 8 ? digits.slice(0, digits.length - 8) : '506';

                                formatted = `(${areaCode}) ${mainDigits.slice(0, 4)}-${mainDigits.slice(4)}`;
                                setPhoneNumber(formatted);
                            } else {
                                setPhoneNumber(phoneToUse);
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error fetching client info for auto-fill:", error);
                }
            }
        };

        if (invoice) {
            fetchClientInfo();
        }
    }, [invoice, firestore]);

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
                    ${input.outerHTML}
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
                    ${input.outerHTML}
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
        const publicUrl = `${getBaseUrl()}/invoices/${invoice.id}`;
        const whatsappMessage = encodeURIComponent(
            `¡Hola! Puedes ver y descargar tu factura #${invoice.invoiceNumber} por un monto de ${formatCurrency(invoice.total)} en el siguiente enlace: ${publicUrl}`
        );
        const whatsappUrl = cleanPhone
            ? `https://wa.me/${cleanPhone}?text=${whatsappMessage}`
            : `https://wa.me/?text=${whatsappMessage}`;
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        setShowPhoneInput(false);
    };

    const handleSendEmail = async () => {
        if (!invoice || !emailAddress) return;

        setIsSendingEmail(true);
        try {
            await sendInvoiceEmail(emailAddress, invoice.id);
            toast({
                title: "¡Email enviado!",
                description: `La factura ha sido enviada a ${emailAddress} exitosamente.`,
            });
            setShowEmailInput(false);
        } catch (error) {
            toast({
                title: "Error al enviar",
                description: error instanceof Error ? error.message : "No se pudo enviar el correo.",
                variant: "destructive",
            });
        } finally {
            setIsSendingEmail(false);
        }
    };


    if (!invoiceId) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto scrollbar-hide p-0 border-none bg-background/95 backdrop-blur-md shadow-2xl will-change-transform">
                <div className="p-6 sm:p-8 space-y-6 sm:space-y-8">
                    <DialogHeader className="items-center text-center space-y-2">
                        <div className="relative">
                            <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full scale-150 shadow-[0_0_30px_rgba(34,197,94,0.2)]" />
                            <CheckCircle className="h-20 w-20 text-green-500 relative mb-4" />
                        </div>
                        <DialogTitle className="text-3xl sm:text-4xl font-black tracking-tighter uppercase leading-none">¡PAGO COMPLETADO!</DialogTitle>
                        <DialogDescription className="text-base font-medium opacity-70">
                            Venta finalizada exitosamente.
                        </DialogDescription>
                    </DialogHeader>
                    {isLoading ? <p className="text-center py-12 text-slate-500 font-bold uppercase tracking-widest italic">Generando comprobante...</p> : invoice && (
                        <>
                            <div className="py-8 sm:py-10 text-center bg-muted/30 rounded-3xl border-2 border-dashed border-primary/20 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-1">Comprobante N°</p>
                                <p className="text-5xl sm:text-6xl font-black font-mono tracking-tighter text-primary drop-shadow-sm">{invoice.invoiceNumber.split('-')[1]}</p>
                                <div className="mt-6 px-6 space-y-2 relative">
                                    <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground truncate max-w-[80%] mx-auto">{invoice.clientName}</p>
                                    <p className="text-4xl font-black text-foreground tracking-tight">{formatCurrency(invoice.total)}</p>
                                </div>
                            </div>

                            {showPhoneInput && (
                                <div className="space-y-4 p-6 bg-green-500/5 border-2 border-green-500/20 rounded-3xl animate-in zoom-in-95 fade-in duration-400">
                                    <Label htmlFor="whatsapp-phone" className="text-[11px] font-black uppercase tracking-[0.2em] text-green-600 dark:text-green-400 ml-1">WhatsApp</Label>
                                    <div className="flex gap-3">
                                        <Input
                                            id="whatsapp-phone"
                                            placeholder="(506) 0000-0000"
                                            value={phoneNumber}
                                            onChange={handlePhoneChange}
                                            className="h-14 font-black text-xl rounded-2xl border-2 border-green-500/30 focus-visible:ring-green-500/50"
                                            autoFocus data-testid="invoicesuccessdialog-phone-input"
                                        />
                                        <Button onClick={handleShareViaWhatsApp} className="h-14 w-14 rounded-2xl bg-green-500 hover:bg-green-600 shrink-0 shadow-lg shadow-green-500/20" id="invoicesuccessdialog-button-1" data-testid="invoicesuccessdialog-next-button">
                                            <ChevronRight className="h-7 w-7" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {showEmailInput && (
                                <div className="space-y-4 p-6 bg-blue-500/5 border-2 border-blue-500/20 rounded-3xl animate-in zoom-in-95 fade-in duration-400">
                                    <Label htmlFor="email-address" className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 ml-1">Correo Electrónico</Label>
                                    <div className="flex gap-3">
                                        <Input
                                            id="email-address"
                                            type="email"
                                            placeholder="cliente@ejemplo.com"
                                            value={emailAddress}
                                            onChange={(e) => setEmailAddress(e.target.value)}
                                            className="h-14 font-black text-xl rounded-2xl border-2 border-blue-500/30 focus-visible:ring-blue-500/50"
                                            autoFocus data-testid="invoicesuccessdialog-email-input"
                                        />
                                        <Button
                                            onClick={handleSendEmail}
                                            disabled={isSendingEmail || !emailAddress}
                                            className="h-14 w-14 rounded-2xl bg-blue-500 hover:bg-blue-600 shrink-0 shadow-lg shadow-blue-500/20"
                                            id="invoicesuccessdialog-button-send-email" data-testid="invoicesuccessdialog-action-button"
                                        >
                                            {isSendingEmail ? <Loader2 className="h-6 w-6 animate-spin" /> : <ChevronRight className="h-7 w-7" />}
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
                    <DialogFooter className="mt-4 pt-4 border-t border-muted sm:flex-row gap-4 items-center justify-between">
                        <div className="w-full space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
                                <Button type="button" onClick={handlePrintTicket} disabled={isLoading || !invoice} className="h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl bg-primary text-primary-foreground hover:-translate-y-1 transition-all active:scale-95 group" id="invoicesuccessdialog-button-imprimir-ticket" data-testid="invoicesuccessdialog-action-ticket-button">
                                    <Printer className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
                                    Ticket
                                </Button>
                                <Button type="button" variant="outline" onClick={handlePrintInvoice} disabled={isLoading || !invoice} className="h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 shadow-sm hover:bg-muted active:scale-95 group" id="invoicesuccessdialog-button-factura-full" data-testid="invoicesuccessdialog-action-invoice-button">
                                    <FileText className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
                                    Factura
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 border-blue-500/30 text-blue-600 hover:bg-blue-500 hover:text-white shadow-sm active:scale-95 group"
                                    disabled={isLoading || !invoice}
                                    onClick={() => setShowEmailInput(true)} id="invoicesuccessdialog-button-enviar-email" data-testid="invoicesuccessdialog-action-email-button"
                                >
                                    <Mail className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
                                    Correo
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 border-green-500/30 text-green-600 hover:bg-green-500 hover:text-white shadow-sm active:scale-95 group"
                                    disabled={isLoading || !invoice}
                                    onClick={() => setShowPhoneInput(true)} id="invoicesuccessdialog-button-enviar-whatsapp" data-testid="invoicesuccessdialog-action-whatsapp-button"
                                >
                                    <WhatsAppIcon className="mr-2 h-5 w-5 fill-current transition-transform group-hover:scale-110" />
                                    WhatsApp
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleDownloadPdf}
                                    disabled={isLoading || !invoice}
                                    className="h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 shadow-sm hover:bg-muted active:scale-95 group"
                                    id="invoicesuccessdialog-button-bajar-pdf" data-testid="invoicesuccessdialog-action-pdf-button"
                                >
                                    <Download className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
                                    PDF
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 border-primary/30 text-primary hover:bg-primary hover:text-white shadow-sm group"
                                    disabled={isLoading || !invoice}
                                    onClick={() => window.open(`${window.location.origin}/invoices/${invoiceId}`, '_blank')}
                                >
                                    <Share2 className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                                    Vista Previa
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => onOpenChange(false)} 
                                    className="h-16 rounded-2xl font-black uppercase text-[10px] tracking-widest text-foreground hover:bg-white hover:text-black border-2 transition-all duration-300" 
                                    id="invoicesuccessdialog-button-close-manual" 
                                    data-testid="invoicesuccessdialog-close-button"
                                >
                                    Cerrar
                                </Button>
                            </div>

                            {(showPhoneInput || showEmailInput) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setShowPhoneInput(false); setShowEmailInput(false); }}
                                    className="h-10 w-full font-black uppercase text-[10px] tracking-widest text-muted-foreground hover:bg-muted/50 transition-colors"
                                    id="invoicesuccessdialog-button-cancelar-y-volver" data-testid="invoicesuccessdialog-action-hide-button"
                                >
                                    Ocultar Campo
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
