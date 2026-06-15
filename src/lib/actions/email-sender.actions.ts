'use server';

import nodemailer from 'nodemailer';
import { Invoice, EmailTemplate, SystemSettings } from '@/types';
import { generateInvoicePdf } from './invoice-pdf.actions';

export async function sendInvoiceEmail(
  emailAddress: string, 
  invoice: Invoice,
  settings: SystemSettings,
  template: EmailTemplate,
  companyInfo: any,
  clientPhone: string
): Promise<{ success: boolean; messageId?: string }> {
  try {
    console.log(`[EmailService] Iniciando envío de factura ${invoice.invoiceNumber} a ${emailAddress}`);
    
    const formatCRC = (amount: number) => 
      `CRC ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Format details table
    const itemsHtml = invoice.items.map(item => `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; table-layout: auto;">
        <tr>
          <td width="70%" style="color: #78716c; font-size: 11px; font-weight: 700; text-transform: uppercase; padding-right: 10px; word-break: break-word;">${item.description}</td>
          <td width="30%" align="right" style="color: #f5f5f4; font-size: 15px; font-weight: 600; white-space: nowrap;">${formatCRC(item.total)}</td>
        </tr>
      </table>
    `).join('');

    // Variable substitution map
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

    // Generate PDF Attachment on the Server
    const pdfBuffer = await generateInvoicePdf(invoice, companyInfo, emailAddress, clientPhone);

    // Setup Nodemailer Transport
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost || 'smtp.gmail.com',
      port: settings.smtpPort || 465,
      secure: (settings.smtpPort === 465), 
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });

    // Send Real Email
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

    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error sending invoice email:', error);
    throw error instanceof Error ? error : new Error('Error desconocido al enviar el correo.');
  }
}

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

    await transporter.verify();

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
