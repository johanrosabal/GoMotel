'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Utensils, Loader2, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { QRCodeCanvas } from 'qrcode.react';
import type { Room } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface ExportRoomMenuQRButtonProps {
    rooms: Room[];
}

export default function ExportRoomMenuQRButton({ rooms }: ExportRoomMenuQRButtonProps) {
    const [isExporting, setIsExporting] = useState(false);
    const { toast } = useToast();

    const handleExportPDF = async () => {
        if (!rooms || rooms.length === 0) {
            toast({ title: 'Error', description: 'No hay habitaciones para exportar.', variant: 'destructive' });
            return;
        }

        setIsExporting(true);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const sortedRooms = [...rooms].sort((a, b) => 
                a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' })
            );

            let confirmedCount = 0;
            for (let i = 0; i < sortedRooms.length; i++) {
                const room = sortedRooms[i];
                const qrId = `qr-menu-room-${room.id}`;
                const canvas = document.getElementById(qrId) as HTMLCanvasElement;
                
                if (!canvas) continue;

                if (confirmedCount > 0) pdf.addPage();
                confirmedCount++;

                // Draw Header (Motel Gold/Black for Menu)
                pdf.setFillColor(15, 15, 15);
                pdf.rect(0, 0, pageWidth, 50, 'F');
                
                pdf.setTextColor(212, 175, 55); // Gold color
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(28);
                pdf.text('HOTEL DU MANOLO', pageWidth / 2, 25, { align: 'center' });
                
                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'normal');
                pdf.text('MENÚ GOURMET & SERVICIO A SUITE', pageWidth / 2, 38, { align: 'center' });

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
                pdf.text('ESCANEÉ PARA VER EL MENÚ Y REALIZAR PEDIDOS', pageWidth / 2, 125, { align: 'center' });

                // QR Code
                const qrSize = 100;
                const qrX = (pageWidth - qrSize) / 2;
                const qrY = 140;

                const imgData = canvas.toDataURL('image/png');
                pdf.addImage(imgData, 'PNG', qrX, qrY, qrSize, qrSize);

                // Add Hyperlinks
                const orderUrl = `${window.location.origin}/public/order?roomId=${room.id}`;
                pdf.link(qrX, qrY, qrSize, qrSize, { url: orderUrl }); // Over QR
                pdf.link(20, 115, pageWidth - 40, 20, { url: orderUrl }); // Over Instructions

                // Footer
                pdf.setFontSize(10);
                pdf.setTextColor(150, 150, 150);
                pdf.text('© HOTEL DU MANOLO - SERVICIO 24/7', pageWidth / 2, pageHeight - 10, { align: 'center' });
            }

            // --- Summary Page ---
            pdf.addPage();
            pdf.setFillColor(15, 15, 15);
            pdf.rect(0, 0, pageWidth, 40, 'F');
            pdf.setTextColor(212, 175, 55);
            pdf.setFontSize(22);
            pdf.setFont('helvetica', 'bold');
            pdf.text('ÍNDICE DE ENLACES - MENÚ', pageWidth / 2, 25, { align: 'center' });

            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            
            let yPos = 55;
            // Table Header
            pdf.setFillColor(245, 245, 245);
            pdf.rect(15, yPos - 5, pageWidth - 30, 8, 'F');
            pdf.text('HAB.', 20, yPos);
            pdf.text('TIPO DE SUITE', 45, yPos);
            pdf.text('ENLACE DE PEDIDO (HAGA CLICK)', 95, yPos);
            
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            yPos += 10;

            for (const room of sortedRooms) {
                if (yPos > pageHeight - 20) {
                    pdf.addPage();
                    yPos = 30;
                }
                
                const orderUrl = `${window.location.origin}/public/order?roomId=${room.id}`;
                
                pdf.setTextColor(40, 40, 40);
                pdf.text(room.number, 20, yPos);
                pdf.text(room.roomTypeName.substring(0, 20), 45, yPos);
                
                pdf.setTextColor(0, 0, 255);
                pdf.text(orderUrl, 95, yPos);
                pdf.link(95, yPos - 4, 100, 6, { url: orderUrl });
                
                pdf.setDrawColor(240, 240, 240);
                pdf.line(15, yPos + 2, pageWidth - 15, yPos + 2);
                
                yPos += 8;
            }

            pdf.save(`QR_Menu_Suites_${new Date().toISOString().split('T')[0]}.pdf`);
            toast({ title: '¡Éxito!', description: 'El PDF de Menús ha sido generado.' });
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast({ title: 'Error', description: 'Ocurrió un error al generar el PDF.', variant: 'destructive' });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none" aria-hidden="true">
                {rooms.map(room => (
                    <QRCodeCanvas 
                        key={room.id}
                        id={`qr-menu-room-${room.id}`}
                        value={`${window.location.origin}/public/order?roomId=${room.id}`}
                        size={512}
                        level="H"
                        includeMargin={true}
                    />
                ))}
            </div>

            <Button 
                variant="outline" 
                onClick={handleExportPDF} 
                disabled={isExporting}
                className="rounded-full font-black uppercase tracking-widest text-[10px] h-12 px-6 border-primary/20 shadow-xl bg-slate-900/50 hover:bg-primary/20 text-white hover:text-white transition-all hover:scale-105 active:scale-95"
            >
                {isExporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                ) : (
                    <Utensils className="mr-2 h-4 w-4 text-primary" />
                )}
                {isExporting ? 'Generando...' : 'QRs Menú'}
            </Button>
        </>
    );
}
