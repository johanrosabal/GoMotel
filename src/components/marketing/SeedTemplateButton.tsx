'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { saveEmailTemplate } from '@/lib/actions/email.actions';
import { getLandingPageContent } from '@/lib/actions/cms.actions';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export function SeedTemplateButton() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const handleSeed = () => {
    startTransition(async () => {
      try {
        // Fetch real info for placeholders context (though we'll use dynamic variables)
        const commercialInfo = await getLandingPageContent();
        
        const INVOICE_HTML = `
<div style="background-color: #0c0a09; margin: 0; padding: 60px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #e7e5e4;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #1c1917; border-collapse: collapse; border-radius: 24px; overflow: hidden; border: 1px solid #44403c; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);">
    <!-- Header -->
    <tr>
      <td align="center" style="padding: 60px 20px; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); border-bottom: 2px solid #fbbf24;">
        <h1 style="margin: 0; color: #fbbf24; font-size: 28px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">{{nombre_empresa}}</h1>
        <p style="margin: 8px 0 0; color: #a5b4fc; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Experiencia de Lujo & Privacidad</p>
      </td>
    </tr>
    
    <!-- Body -->
    <tr>
      <td style="padding: 40px 20px;">
        <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">Hola, {{nombre_cliente}}</h2>
        <p style="margin: 0 0 32px; color: #a8a29e; font-size: 16px; line-height: 1.7;">Es un honor para nosotros confirmarle los detalles de su reciente estancia. Esperamos que haya disfrutado de la calidad y excelencia que nos caracteriza.</p>
        
        <!-- Invoice Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #292524; border-radius: 16px; border: 1px solid #44403c; border-collapse: separate;">
          <tr>
            <td style="padding: 32px;">
              <!-- Dynamic Invoice Items -->
              {{detalle_factura_html}}
              
              <div style="border-top: 1px solid #44403c; padding-top: 24px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td width="40%" style="color: #fbbf24; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; padding-bottom: 5px;">Inversión Total</td>
                    <td width="60%" align="right" style="color: #ffffff; font-size: 22px; font-weight: 900; line-height: 1.1; white-space: nowrap;">{{monto_total}}</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
        </table>
        
        <p style="margin: 32px 0; color: #a8a29e; font-size: 14px; line-height: 1.6;">Si requiere una factura electrónica detallada o desea gestionar una nueva experiencia, puede hacerlo a través de nuestro portal oficial.</p>
        
        <!-- Button -->
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
          <tr>
            <td align="center" style="background-color: #fbbf24; border-radius: 12px;">
              <a href="{{url_factura_pdf}}" style="display: inline-block; padding: 20px 40px; color: #000000; text-decoration: none; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Descargar Comprobante PDF</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding: 40px 20px; background-color: #111111; border-top: 1px solid #292524; text-align: center;">
        <p style="margin: 0 0 8px; color: #78716c; font-size: 12px; font-weight: 700;">{{nombre_empresa}} - Centro de Hospitalidad</p>
        <p style="margin: 0 0 4px; color: #57534e; font-size: 12px;">{{direccion_empresa}}</p>
        <p style="margin: 0; color: #57534e; font-size: 12px;">Tel: <span style="color: #78716c;">{{telefono_empresa}}</span> | <span style="color: #78716c;">{{email_empresa}}</span></p>
        <p style="margin: 30px 0 0; color: #44403c; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">&copy; 2026 {{nombre_empresa}}. Documento Privado y Confidencial.</p>
      </td>
    </tr>
  </table>
</div>
        `;

        const id = 'template_billing_luxury_v2';
        await saveEmailTemplate(id, {
          name: 'Template Factura Obsidian Luxury (v2)',
          subject: 'Confirmación de su estancia - {{nombre_empresa}}',
          type: 'invoice',
          bodyHtml: INVOICE_HTML,
          variables: ['nombre_cliente', 'numero_reserva', 'monto_total', 'tipo_habitacion', 'fecha_entrada', 'url_factura_pdf', 'nombre_empresa', 'direccion_empresa', 'email_empresa', 'telefono_empresa', 'detalle_factura_html'],
          createdAt: Date.now()
        });
        toast({ title: '¡Éxito!', description: 'Nuevo diseño de lujo cinemático generado correctamente.' });
        router.refresh();
      } catch (error) {
        toast({ title: 'Error', description: 'No se pudo generar el nuevo diseño.', variant: 'destructive' });
      }
    });
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleSeed} 
      disabled={isPending}
      className={cn(
        "h-9 gap-2 px-4 rounded-full font-black uppercase text-[10px] tracking-widest transition-all duration-300 shadow-sm",
        "bg-primary/20 border-primary/40 text-primary",
        "hover:bg-primary hover:text-white", 
        "dark:bg-primary/30 dark:border-primary/50 dark:text-primary dark:hover:bg-primary dark:hover:text-white"
      )}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      ✨ Auto-Generar Factura Pro
    </Button>
  );
}
