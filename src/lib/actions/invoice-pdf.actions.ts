import { jsPDF } from 'jspdf';
import { Invoice } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Generates a professional PDF invoice on the server using jsPDF.
 * This version uses standard primitives (text, line, rect) for maximum reliability in Node.js.
 */
export async function generateInvoicePdf(invoice: Invoice, companyInfo?: any): Promise<Buffer> {
  // ISO-8859-1 is often safer for standard PDFs, but jsPDF handles UTF-8 well enough
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 20;

  // Header - Dark background for Title
  doc.setFillColor(31, 41, 55); // gray-800
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Company Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(companyInfo?.tradeName || 'GO MOTEL', margin, 25);

  // Invoice Label
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('COMPROBANTE DE PAGO', pageWidth - margin - 45, 20);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoiceNumber, pageWidth - margin - 45, 28);

  currentY = 55;

  // Billing Info
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURAR A:', margin, currentY);
  doc.text('FECHA:', pageWidth / 2, currentY);

  currentY += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.clientName, margin, currentY);
  
  const dateStr = invoice.createdAt 
    ? format(new Date(invoice.createdAt.seconds * 1000), "dd 'de' MMMM, yyyy", { locale: es })
    : format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(dateStr, pageWidth / 2, currentY);

  currentY += 15;

  // Table Header
  doc.setFillColor(243, 244, 246); // gray-100
  doc.rect(margin, currentY, pageWidth - (margin * 2), 10, 'F');
  
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPCION', margin + 5, currentY + 7);
  doc.text('CANT', pageWidth - margin - 50, currentY + 7);
  doc.text('PRECIO', pageWidth - margin - 30, currentY + 7);
  doc.text('TOTAL', pageWidth - margin - 10, currentY + 7, { align: 'right' });

  currentY += 10;

  // Table Items
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  invoice.items.forEach((item, index) => {
    currentY += 10;
    
    // Alt row background
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, currentY - 7, pageWidth - (margin * 2), 10, 'F');
    }

    doc.setTextColor(0, 0, 0);
    doc.text(item.description, margin + 5, currentY);
    doc.text(item.quantity.toString(), pageWidth - margin - 50, currentY);
    doc.text(`$${item.unitPrice.toFixed(2)}`, pageWidth - margin - 30, currentY);
    doc.text(`$${item.total.toFixed(2)}`, pageWidth - margin - 10, currentY, { align: 'right' });
    
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, currentY + 3, pageWidth - margin, currentY + 3);
  });

  currentY += 20;

  // Totals
  const totalBoxWidth = 60;
  const startX = pageWidth - margin - totalBoxWidth;

  doc.setTextColor(100, 100, 100);
  doc.text('Subtotal:', startX, currentY);
  doc.setTextColor(0, 0, 0);
  doc.text(`$${invoice.subtotal.toFixed(2)}`, pageWidth - margin - 10, currentY, { align: 'right' });

  invoice.taxes.forEach(tax => {
    currentY += 8;
    doc.setTextColor(100, 100, 100);
    doc.text(`${tax.name} (${tax.percentage}%):`, startX, currentY);
    doc.setTextColor(0, 0, 0);
    doc.text(`$${tax.amount.toFixed(2)}`, pageWidth - margin - 10, currentY, { align: 'right' });
  });

  currentY += 12;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(startX, currentY - 5, pageWidth - margin, currentY - 5);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', startX, currentY);
  doc.text(`$${invoice.total.toFixed(2)}`, pageWidth - margin - 10, currentY, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text('¡Gracias por su preferencia!', pageWidth / 2, 280, { align: 'center' });
  doc.text(`${companyInfo?.tradeName || 'Go Motel'} - Documento de carácter informativo`, pageWidth / 2, 285, { align: 'center' });

  // Return as Buffer
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
