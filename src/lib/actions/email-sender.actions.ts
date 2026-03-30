'use server';

import nodemailer from 'nodemailer';
import { collection, doc, setDoc, getDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { EmailTemplate, Invoice } from '@/types';
import { getCompanyInfo } from './company.actions';
import { getSystemSettings } from './system.actions';
import { generateInvoicePdf } from './invoice-pdf.actions';

/**
 * Sends an invoice email to a client using the best available 'invoice' template.
 * This function is strictly server-side.
 */
export async function sendInvoiceEmail(emailAddress: string, invoiceId: string): Promise<void> {
  try {
    const invoiceRef = doc(db, 'invoices', invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);

    if (!invoiceSnap.exists()) {
      throw new Error(`La factura con ID ${invoiceId} no existe.`);
    }

    const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;

    console.log(`[EmailService] Iniciando envío de factura ${invoice.invoiceNumber} a ${emailAddress}`);
    
    // 1. Get system-wide SMTP settings
    const settings = await getSystemSettings();
    if (!settings.smtpUser || !settings.smtpPass) {
      throw new Error('La configuración SMTP (Email) no está completa en Ajustes del Sistema.');
    }

    // 2. Get the most recent template of type 'invoice'
    const templatesRef = collection(db, 'emailTemplates');
    const q = query(
      templatesRef, 
      where('type', '==', 'invoice'), 
      orderBy('createdAt', 'desc'), 
      limit(1)
    );
    const templateSnapshot = await getDocs(q);
    
    if (templateSnapshot.empty) {
      throw new Error('No se encontró ninguna plantilla de tipo "Factura".');
    }
    
    const template = templateSnapshot.docs[0].data() as EmailTemplate;
    const companyInfo = await getCompanyInfo();
    
    const formatCRC = (amount: number) => 
      `CRC ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // 3. Format details table (Multi-item support)
    const itemsHtml = invoice.items.map(item => `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; table-layout: auto;">
        <tr>
          <td width="70%" style="color: #78716c; font-size: 11px; font-weight: 700; text-transform: uppercase; padding-right: 10px; word-break: break-word;">${item.description}</td>
          <td width="30%" align="right" style="color: #f5f5f4; font-size: 15px; font-weight: 600; white-space: nowrap;">${formatCRC(item.total)}</td>
        </tr>
      </table>
    `).join('');

    // 4. Variable substitution map
    const vars: Record<string, string> = {
      'nombre_cliente': invoice.clientName,
      'email_cliente': emailAddress,
      'monto_total': formatCRC(invoice.total),
      'numero_reserva': invoice.invoiceNumber,
      'nombre_empresa': companyInfo?.tradeName || 'Go Motel',
      'cedula_juridica': companyInfo?.legalId || '',
      'direccion_empresa': companyInfo?.address || '',
      'email_empresa': companyInfo?.emails?.[0]?.value || settings.smtpUser,
      'telefono_empresa': companyInfo?.phoneNumbers?.[0]?.value || '',
      'detalle_factura_html': itemsHtml,
      'url_factura_pdf': '#',
    };

    let finalHtml = template.bodyHtml;
    let finalSubject = template.subject;

    Object.keys(vars).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      finalHtml = finalHtml.replace(regex, vars[key]);
      finalSubject = finalSubject.replace(regex, vars[key]);
    });

    // 5. Fetch additional client info if needed for the PDF
    let clientPhone = '';
    if (invoice.clientId) {
      try {
        const clientRef = doc(db, 'clients', invoice.clientId);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
          const clientData = clientSnap.data();
          clientPhone = clientData.phoneNumber || clientData.whatsappNumber || '';
        }
      } catch (e) {
        console.error('Error fetching client info for PDF:', e);
      }
    }

    // 6. Generate PDF Attachment on the Server
    const pdfBuffer = await generateInvoicePdf(invoice, companyInfo, emailAddress, clientPhone);

    // 6. Setup Nodemailer Transport
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost || 'smtp.gmail.com',
      port: settings.smtpPort || 465,
      secure: (settings.smtpPort === 465), 
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });

    // 7. Send Real Email
    const info = await transporter.sendMail({
      from: settings.smtpFrom || `${vars.nombre_empresa} <${settings.smtpUser}>`,
      to: emailAddress,
      subject: finalSubject,
      html: finalHtml,
      attachments: [
        {
          filename: `factura-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    console.log(`[EmailService] Email REAL enviado: ${info.messageId}`);

    // 8. Log the sending in Firestore
    const logRef = doc(collection(db, 'emailLogs'));
    await setDoc(logRef, {
      to: emailAddress,
      invoiceId: invoice.id,
      templateId: templateSnapshot.docs[0].id,
      subject: finalSubject,
      sentAt: Date.now(),
      status: 'success',
      messageId: info.messageId,
      contentPreview: finalHtml.substring(0, 500)
    });

  } catch (error) {
    console.error('Error sending invoice email:', error);
    throw error instanceof Error ? error : new Error('Error desconocido al enviar el correo.');
  }
}

/**
 * Tests the SMTP connection by verifying credentials and sending a test email.
 */
export async function testSmtpConnection(config: {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    // 1. Verify connection
    await transporter.verify();

    // 2. Send a real test email to the user himself
    await transporter.sendMail({
      from: config.smtpFrom || `Go Motel Test <${config.smtpUser}>`,
      to: config.smtpUser,
      subject: '🚀 PRUEBA DE CONEXIÓN SMTP - Go Motel',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #6d28d9;">¡Conexión Exitosa!</h2>
          <p>Si estás leyendo esto, significa que la configuración de Gmail para <b>Go Motel</b> es correcta.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 12px; color: #64748b;">Este es un correo generado automáticamente para verificar tu configuración.</p>
        </div>
      `,
    });

    return { success: true, message: '¡Conexión exitosa! Revisa tu bandeja de entrada en ' + config.smtpUser };
  } catch (error: any) {
    console.error('SMTP Test Error:', error);
    return { 
      success: false, 
      message: error.message.includes('Invalid login') 
        ? 'Error de autenticación: Verifica el usuario o usa una Contraseña de Aplicación.' 
        : (error.message || 'Error al conectar con el servidor SMTP.') 
    };
  }
}
