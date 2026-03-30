'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { QrCode, Loader2, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { QRCodeCanvas } from 'qrcode.react';
import type { Room } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface ExportRoomQRButtonProps {
    rooms: Room[];
}

export default function ExportRoomQRButton({ rooms }: ExportRoomQRButtonProps) {
    const [isExporting, setIsExporting] = useState(false);
    const { toast } = useToast();

    const handleExportPDF = async () => {
        if (!rooms || rooms.length === 0) {
            toast({ title: 'Error', description: 'No hay habitaciones para exportar.', variant: 'destructive' });
            return;
        }

        setIsExporting(true);
        // Wait a small bit to ensure hidden canvases are rendered if rooms changed
        await new Promise(resolve => setTimeout(resolve, 300));
        
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // Sort rooms numerically by their number string (handles 1, 01, 101 correctly)
            const sortedRooms = [...rooms].sort((a, b) => 
                a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' })
            );

            let confirmedCount = 0;
            for (let i = 0; i < sortedRooms.length; i++) {
                const room = sortedRooms[i];
                
                const qrId = `qr-room-${room.id}`;
                const canvas = document.getElementById(qrId) as HTMLCanvasElement;
                
                // If canvas is not found, skip or alert (defensive check)
                if (!canvas) {
                    console.warn(`Canvas not found for room ${room.number}`);
                    continue;
                }

                if (confirmedCount > 0) pdf.addPage();
                confirmedCount++;

                // Draw Header (Motel Red/Black)
                pdf.setFillColor(15, 15, 15);
                pdf.rect(0, 0, pageWidth, 50, 'F');
                
                pdf.setTextColor(230, 230, 230);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(28);
                pdf.text('HOTEL DU MANOLO', pageWidth / 2, 25, { align: 'center' });
                
                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'normal');
                pdf.text('SISTEMA DE VERIFICACIÓN DE INGRESO', pageWidth / 2, 38, { align: 'center' });

                // Room Large Number
                pdf.setTextColor(0, 0, 0);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(80);
                pdf.text(`${room.number}`, pageWidth / 2, 90, { align: 'center' });
                
                pdf.setFontSize(22);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(80, 80, 80);
                pdf.text(`SUITE ${room.roomTypeName.toUpperCase()}`, pageWidth / 2, 105, { align: 'center' });

                // Instructions
                pdf.setTextColor(40, 40, 40);
                pdf.setFontSize(16);
                pdf.text('ESCANEÉ ESTE CÓDIGO QR PARA CONFIRMAR SU INGRESO', pageWidth / 2, 125, { align: 'center' });

                // QR Code
                const qrSize = 100;
                const qrX = (pageWidth - qrSize) / 2;
                const qrY = 140;

                // Add QR Code image
                const imgData = canvas.toDataURL('image/png');
                pdf.addImage(imgData, 'PNG', qrX, qrY, qrSize, qrSize);

                // Footer
                pdf.setFontSize(10);
                pdf.setTextColor(150, 150, 150);
                pdf.text('© HOTEL DU MANOLO - CONTROL DE ACCESO', pageWidth / 2, pageHeight - 10, { align: 'center' });
            }

            pdf.save(`QR_Suites_${new Date().toISOString().split('T')[0]}.pdf`);
            toast({ title: '¡Éxito!', description: 'El PDF ha sido generado correctamente.' });
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast({ title: 'Error', description: 'Ocurrió un error al generar el PDF.', variant: 'destructive' });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            {/* Hidden QR Codes for PDF generation */}
            <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none" aria-hidden="true">
                {rooms.map(room => (
                    <QRCodeCanvas 
                        key={room.id}
                        id={`qr-room-${room.id}`}
                        value={`${window.location.origin}/room-checkin/${room.id}`}
                        size={512} // High res for PDF
                        level="H"
                        includeMargin={true}
                    />
                ))}
            </div>

            <Button 
                variant="outline" 
                onClick={handleExportPDF} 
                disabled={isExporting}
                className="rounded-full font-black uppercase tracking-widest text-[10px] h-12 px-6 border-white/10 shadow-xl bg-slate-900/50 hover:bg-slate-800 text-white transition-all hover:scale-105 active:scale-95"
                id="export-room-qr-button"
            >
                {isExporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                ) : (
                    <Download className="mr-2 h-4 w-4 text-primary" />
                )}
                {isExporting ? 'Generando...' : 'Exportar QR (PDF)'}
            </Button>
        </>
    );
}
