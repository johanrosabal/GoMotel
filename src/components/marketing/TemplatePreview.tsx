'use client';

import { useMemo, useState } from 'react';
import { Monitor, Smartphone, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface TemplatePreviewProps {
  bodyHtml: string;
  subject: string;
  variables: string[];
}

const SAMPLE_DATA: Record<string, string> = {
  nombre_cliente: 'Juan Pérez',
  email_cliente: 'juan.perez@email.com',
  monto_total: 'CRC 150.00',
  numero_reserva: 'RSV-2026-88',
  fecha_entrada: '15/05/2026',
  fecha_salida: '17/05/2026',
  tipo_habitacion: 'Master Suite con Jacuzzi',
  nombre_empresa: 'Hotel Du Manolo',
  direccion_empresa: 'San José, Costa Rica, calle 45',
  email_empresa: 'contacto@hoteldumanolo.com',
  telefono_empresa: '+(506) 8888-9999',
  detalle_factura_html: `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; table-layout: auto;">
      <tr>
        <td width="70%" style="color: #78716c; font-size: 11px; font-weight: 700; text-transform: uppercase; word-break: break-word; padding-right: 10px;">Estancia Master Suite</td>
        <td width="30%" align="right" style="color: #f5f5f4; font-size: 15px; font-weight: 600; white-space: nowrap;">CRC 120.00</td>
      </tr>
    </table>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; table-layout: auto;">
      <tr>
        <td width="70%" style="color: #78716c; font-size: 11px; font-weight: 700; text-transform: uppercase; word-break: break-word; padding-right: 10px;">Consumo Mini-bar</td>
        <td width="30%" align="right" style="color: #f5f5f4; font-size: 15px; font-weight: 600; white-space: nowrap;">CRC 20.00</td>
      </tr>
    </table>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; table-layout: auto;">
      <tr>
        <td width="70%" style="color: #78716c; font-size: 11px; font-weight: 700; text-transform: uppercase; word-break: break-word; padding-right: 10px;">Hora Extra (Late Checkout)</td>
        <td width="30%" align="right" style="color: #f5f5f4; font-size: 15px; font-weight: 600; white-space: nowrap;">CRC 10.00</td>
      </tr>
    </table>
  `,
  url_factura_pdf: '#',
};

export function TemplatePreview({ bodyHtml, subject, variables }: TemplatePreviewProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  const renderedHtml = useMemo(() => {
    let result = bodyHtml;
    // Reemplazar todas las variables encontradas en SAMPLE_DATA
    Object.entries(SAMPLE_DATA).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    });

    // Para variables no definidas en SAMPLE_DATA, mostrar un placeholder genérico
    variables.forEach(v => {
      if (!SAMPLE_DATA[v]) {
        const regex = new RegExp(`{{${v}}}`, 'g');
        result = result.replace(regex, `[${v}]`);
      }
    });

    // Inyectar resets de CSS básicos para mejorar responsividad en el iframe
    const styleReset = `
      <style>
        body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; overflow-x: hidden; font-smoothing: antialiased; }
        table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100% !important; }
        img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        * { box-sizing: border-box; max-width: 100% !important; }
        @media only screen and (max-width: 480px) {
          .responsive-padding { padding: 15px !important; }
          /* Fix for large amounts in total section */
          td[align="right"] { 
            font-size: 18px !important; 
            white-space: nowrap !important;
            padding-left: 10px !important;
          }
          /* Prevent description labels from being too wide */
          td:first-child { 
            font-size: 10px !important;
            line-height: 1.2 !important;
          }
          /* Global font-size limiter for mobile preview */
          td[style*="font-size: 26px"], td[style*="font-size: 24px"] {
             font-size: 18px !important;
             line-height: 1.1 !important;
          }
          /* Ensure the main table doesn't overflow */
          table[style*="max-width: 600px"] {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      </style>
    `;

    return styleReset + result;
  }, [bodyHtml, variables]);

  const renderedSubject = useMemo(() => {
    let result = subject;
    Object.entries(SAMPLE_DATA).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    });
    return result;
  }, [subject]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg border border-primary/10">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={viewMode === 'desktop' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('desktop')}
            className={cn(
              "h-8 gap-2 text-[10px] font-black uppercase tracking-wider transition-all",
              viewMode === 'desktop' ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
            )} data-testid="templatepreview-action-desktop-button"
          >
            <Monitor className="h-3.5 w-3.5" /> Escritorio
          </Button>
          <Button
            type="button"
            variant={viewMode === 'mobile' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('mobile')}
            className={cn(
              "h-8 gap-2 text-[10px] font-black uppercase tracking-wider transition-all",
              viewMode === 'mobile' ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
            )} data-testid="templatepreview-action-mobile-button"
          >
            <Smartphone className="h-3.5 w-3.5" /> Móvil
          </Button>
        </div>

        <div className="text-[10px] text-foreground/60 dark:text-muted-foreground font-mono flex items-center gap-2">
          <RefreshCw className="h-3 w-3 animate-spin-slow" /> Vista previa en vivo
        </div>
      </div>

      <Card className="overflow-hidden border-primary/10 shadow-2xl bg-zinc-900/5 dark:bg-zinc-100/5">
        <div className="bg-muted p-4 border-b flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-muted-foreground w-16">Asunto:</span>
            <span className="text-sm font-bold text-foreground truncate">{renderedSubject || '(Sin asunto)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-muted-foreground w-16">Para:</span>
            <span className="text-sm text-foreground/80">{SAMPLE_DATA.email_cliente}</span>
          </div>
        </div>

        <div className={cn(
          "mx-auto transition-all duration-500 min-h-[500px] border-x shadow-inner overflow-hidden",
          viewMode === 'desktop' ? "w-full" : "max-w-[375px]"
        )}>
          <iframe
            srcDoc={renderedHtml}
            title="Email Preview"
            className="w-full h-[600px] border-none"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      </Card>

      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
          Variables Utilizadas en esta vista
        </h4>
        <div className="flex flex-wrap gap-2">
          {variables.map(v => (
            <div key={v} className="bg-background border rounded px-2 py-1 text-[10px] font-mono shadow-sm">
              <span className="text-muted-foreground">{`{{${v}}}`}</span> → <span className="font-bold text-primary">{SAMPLE_DATA[v] || `[${v}]`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
