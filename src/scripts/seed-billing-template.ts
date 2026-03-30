import fs from 'fs';
import path from 'path';

// Manual env load
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) envVars[key.trim()] = value.trim().replace(/"/g, '');
});

process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = envVars.NEXT_PUBLIC_FIREBASE_APP_ID;
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = envVars.NEXT_PUBLIC_FIREBASE_API_KEY;
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = envVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

console.log('Project ID manually loaded:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const billingTemplateHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f7; color: #51545e; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f4f4f7; padding-bottom: 40px; }
        .content { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin-top: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        .header { background-color: #1a1a1a; color: #ffffff; padding: 40px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; text-transform: uppercase; color: #eab308; }
        .body { padding: 40px; }
        .body h2 { font-size: 18px; font-weight: 700; color: #1a1a1a; margin-top: 0; }
        .body p { font-size: 14px; line-height: 1.6; color: #51545e; }
        .invoice-box { background-color: #f9fafb; border: 1px border #e5e7eb; border-radius: 12px; padding: 25px; margin: 25px 0; }
        .invoice-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
        .invoice-row.total { border-top: 2px solid #e5e7eb; padding-top: 15px; margin-top: 15px; font-weight: 800; font-size: 18px; color: #1a1a1a; }
        .button-container { text-align: center; margin-top: 35px; }
        .button { background-color: #eab308; color: #000000; padding: 15px 30px; text-decoration: none; border-radius: 50px; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; display: inline-block; }
        .footer { text-align: center; padding: 30px; font-size: 12px; color: #94a3b8; }
        @media only screen and (max-width: 600px) {
            .body { padding: 25px; }
            .header { padding: 30px 15px; }
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="content">
            <div class="header">
                <h1>{{nombre_empresa}}</h1>
            </div>
            <div class="body">
                <h2>¡Hola, {{nombre_cliente}}!</h2>
                <p>Adjunto a este correo encontrarás el detalle de tu factura correspondiente a tu estancia reciente. Gracias por elegirnos para tus momentos de descanso y privacidad.</p>
                
                <div class="invoice-box">
                    <div class="invoice-row">
                        <span>Reserva #</span>
                        <strong>{{numero_reserva}}</strong>
                    </div>
                    <div class="invoice-row">
                        <span>Habitación</span>
                        <strong>{{tipo_habitacion}}</strong>
                    </div>
                    <div class="invoice-row">
                        <span>Fecha</span>
                        <strong>{{fecha_entrada}}</strong>
                    </div>
                    <div class="invoice-row total">
                        <span>Total Pagado</span>
                        <span>{{monto_total}}</span>
                    </div>
                </div>

                <p>Nuestra misión es brindarte una experiencia excepcional. Si tienes alguna duda sobre este cargo, no dudes en contactarnos respondiendo a este correo.</p>
                
                <div class="button-container">
                    <a href="{{url_factura_pdf}}" class="button">Descargar Factura PDF</a>
                </div>
            </div>
            <div class="footer">
                <p>&copy; 2026 {{nombre_empresa}}. Todos los derechos reservados.<br>Costa Rica.</p>
            </div>
        </div>
    </div>
</body>
</html>
`;

async function seed() {
  const templateId = 'template_invoice_pro_001';
  const templateData = {
    name: 'Factura Profesional Premium',
    subject: 'Su Factura de {{nombre_empresa}} - Reserva #{{numero_reserva}}',
    type: 'invoice',
    bodyHtml: billingTemplateHTML,
    variables: [
      'nombre_cliente',
      'nombre_empresa',
      'numero_reserva',
      'tipo_habitacion',
      'fecha_entrada',
      'monto_total',
      'url_factura_pdf'
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  try {
    const templateRef = doc(db, 'emailTemplates', templateId);
    await setDoc(templateRef, templateData);
    console.log('Template de facturación insertado correctamente.');
    process.exit(0);
  } catch (error) {
    console.error('Error al insertar template:', error);
    process.exit(1);
  }
}

seed();
