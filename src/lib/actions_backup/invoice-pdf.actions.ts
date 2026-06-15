import { jsPDF } from 'jspdf';
import { Invoice } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Generates a professional PDF invoice on the server using jsPDF.
 * This version uses standard primitives (text, line, rect) for maximum reliability in Node.js.
 */
export async function generateInvoicePdf(
  invoice: Invoice, 
  companyInfo?: any, 
  clientEmail?: string,
  clientPhone?: string
): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 0;

  // Final Currency Code
  const currencyCode = 'CRC ';

  // --- Header Gradient / Bar ---
  doc.setFillColor(31, 41, 55); // gray-800
  doc.rect(0, 0, pageWidth, 45, 'F');

  // --- Company Logo Section ---
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(companyInfo?.tradeName || 'GO MOTEL', margin, 25);

  // --- Invoice Info (Right aligned in header) ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('COMPROBANTE DE PAGO', pageWidth - margin, 20, { align: 'right' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoiceNumber, pageWidth - margin, 30, { align: 'right' });

  currentY = 60;

  // --- Header Section - Emisor (Left) vs Receptor (Right-aligned) ---
  const rightColumnX = pageWidth - margin;

  // 1. Emisor Column (Left aligned)
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('EMISOR:', margin, currentY);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  currentY += 6;
  doc.text(companyInfo?.tradeName || 'Go Motel', margin, currentY);
  if (companyInfo?.address) {
    currentY += 5;
    const splitAddress = doc.splitTextToSize(companyInfo.address, 70);
    doc.text(splitAddress, margin, currentY);
    currentY += (splitAddress.length * 4);
  }
  
  const phone = companyInfo?.phoneNumbers?.[0]?.value || '';
  const email = companyInfo?.emails?.[0]?.value || '';
  if (phone || email) {
    doc.text(`${phone}${phone && email ? ' | ' : ''}${email}`, margin, currentY);
    currentY += 5;
  }

  // 2. Receptor Column (Full Right Alignment)
  let receptorY = 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURAR A:', rightColumnX, receptorY, { align: 'right' });
  
  receptorY += 6;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39); // gray-900
  doc.text(invoice.clientName, rightColumnX, receptorY, { align: 'right' });
  
  receptorY += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99); // gray-600
  const dateStr = invoice.createdAt 
    ? format(new Date(invoice.createdAt.seconds * 1000), "dd 'de' MMMM, yyyy", { locale: es })
    : format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });
  doc.text(`Fecha: ${dateStr}`, rightColumnX, receptorY, { align: 'right' });

  if (invoice.paymentMethod) {
    receptorY += 5;
    doc.text(`Método de Pago: ${invoice.paymentMethod}`, rightColumnX, receptorY, { align: 'right' });
  }

  if (clientEmail) {
    receptorY += 5;
    doc.text(`Correo de envío: ${clientEmail}`, rightColumnX, receptorY, { align: 'right' });
  }

  currentY = Math.max(currentY, receptorY) + 20;

  // --- Table Header ---
  doc.setFillColor(243, 244, 246); // gray-100
  doc.rect(margin, currentY, pageWidth - (margin * 2), 10, 'F');
  
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  
  // Table Columns Setup (Final coordinates for maximum clarity)
  const colDescX = margin + 5;
  const colCantX = pageWidth - margin - 85;
  const colPriceX = pageWidth - margin - 45;
  const colTotalX = pageWidth - margin - 5;

  doc.text('DESCRIPCIÓN', colDescX, currentY + 7);
  doc.text('CANT', colCantX, currentY + 7, { align: 'center' });
  doc.text('PRECIO UNIT.', colPriceX, currentY + 7, { align: 'right' });
  doc.text('TOTAL', colTotalX, currentY + 7, { align: 'right' });

  currentY += 10;

  // --- Table Items ---
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  invoice.items.forEach((item, index) => {
    currentY += 10;
    
    // Alt row background
    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 251); // gray-50
      doc.rect(margin, currentY - 7, pageWidth - (margin * 2), 10, 'F');
    }

    const formattedUnitPrice = item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 });
    const formattedTotal = item.total.toLocaleString('en-US', { minimumFractionDigits: 2 });

    doc.setTextColor(0, 0, 0);
    doc.text(item.description, colDescX, currentY);
    doc.text(item.quantity.toString(), colCantX, currentY, { align: 'center' });
    doc.text(`${currencyCode}${formattedUnitPrice}`, colPriceX, currentY, { align: 'right' });
    doc.text(`${currencyCode}${formattedTotal}`, colTotalX, currentY, { align: 'right' });
    
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.line(margin, currentY + 3, pageWidth - margin, currentY + 3);
  });

  currentY += 15;

  // --- Totals Section ---
  const totalBoxWidth = 85;
  const startX = pageWidth - margin - totalBoxWidth;

  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text('Subtotal:', startX, currentY);
  doc.setTextColor(0, 0, 0);
  doc.text(`${currencyCode}${invoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, colTotalX, currentY, { align: 'right' });

  invoice.taxes.forEach(tax => {
    currentY += 8;
    doc.setTextColor(75, 85, 99);
    doc.text(`${tax.name} (${tax.percentage}%):`, startX, currentY);
    doc.setTextColor(0, 0, 0);
    doc.text(`${currencyCode}${tax.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, colTotalX, currentY, { align: 'right' });
  });

  // Final Total Box
  currentY += 12;
  doc.setFillColor(17, 24, 39); // gray-900 (darker)
  doc.rect(startX - 5, currentY - 7, totalBoxWidth + 5, 12, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total a Pagar:', startX, currentY);
  doc.text(`${currencyCode}${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, colTotalX, currentY, { align: 'right' });

  // --- Footer ---
  const footerY = 280;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(156, 163, 175); // gray-400
  doc.text('¡Gracias por su preferencia!', pageWidth / 2, footerY - 10, { align: 'center' });
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const companyPhone = companyInfo?.phoneNumbers?.[0]?.value || '';
  const companyEmail = companyInfo?.emails?.[0]?.value || '';
  const footerInfo = `${companyInfo?.tradeName || 'Go Motel'} | Céd. Jurídica: ${companyInfo?.legalId || 'N/A'}`;
  const contactInfo = `${companyPhone}${companyPhone && companyEmail ? ' | ' : ''}${companyEmail}`;
  
  doc.text(footerInfo, pageWidth / 2, footerY - 5, { align: 'center' });
  doc.text(contactInfo, pageWidth / 2, footerY, { align: 'center' });
  doc.text('Este documento es un comprobante de pago informativo.', pageWidth / 2, footerY + 5, { align: 'center' });

  // Return as Buffer
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
