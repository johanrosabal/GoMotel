'use client';

import React from 'react';
import type { Reservation } from '@/types';
import ReservationTicketTemplate from './ReservationTicketTemplate';
import { Button } from '@/components/ui/button';
import { Download, Printer, Home } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Link from 'next/link';

interface PublicReservationPageProps {
    reservationData: any; // Serialized reservation
}

export default function PublicReservationPage({ reservationData }: PublicReservationPageProps) {
    const ticketRef = React.useRef<HTMLDivElement>(null);

    // Re-construct the Firestore-like structure for the template
    const reservation: Reservation = {
        ...reservationData,
        checkInDate: { toDate: () => new Date(reservationData.checkInDate) },
        checkOutDate: { toDate: () => new Date(reservationData.checkOutDate) },
        createdAt: { toDate: () => new Date(reservationData.createdAt) },
    };

    const handleDownloadPdf = () => {
        const input = ticketRef.current;
        if (!input) return;

        html2canvas(input, { scale: 2 }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', [80, 150]); // Custom size for ticket
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`reservacion-${reservation.id.slice(-6)}.pdf`);
        });
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-8">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Tu Reservación</h1>
                    <p className="text-slate-400 font-medium">Gracias por elegir Go Motel</p>
                </div>

                <div className="bg-white rounded-3xl overflow-hidden shadow-2xl shadow-primary/20 p-2 sm:p-4">
                    <ReservationTicketTemplate reservation={reservation} ref={ticketRef} />
                </div>

                <div className="grid grid-cols-2 gap-4 print:hidden">
                    <Button 
                        onClick={handleDownloadPdf}
                        className="h-14 rounded-2xl bg-white text-black hover:bg-slate-200 font-black uppercase tracking-widest text-xs shadow-xl"
                    >
                        <Download className="mr-2 h-5 w-5" />
                        Descargar PDF
                    </Button>
                    <Button 
                        onClick={handlePrint}
                        variant="outline"
                        className="h-14 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs"
                    >
                        <Printer className="mr-2 h-5 w-5" />
                        Imprimir
                    </Button>
                </div>

                <div className="text-center pt-4 print:hidden">
                    <Button asChild variant="link" className="text-slate-500 hover:text-primary transition-colors font-bold uppercase tracking-widest text-[10px]">
                        <Link href="/">
                            <Home className="mr-2 h-3 w-3" />
                            Volver al Inicio
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .bg-white, .bg-white * {
                        visibility: visible;
                    }
                    .bg-white {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        box-shadow: none;
                        padding: 0;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
