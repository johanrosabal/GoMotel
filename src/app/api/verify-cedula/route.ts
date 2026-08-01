import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idCard = searchParams.get('cedula') || searchParams.get('idCard') || '';
  const cleanId = idCard.replace(/\D/g, '');

  if (cleanId.length < 8) {
    return NextResponse.json({ success: false, error: 'Cédula incompleta (mínimo 8-9 dígitos).' }, { status: 400 });
  }

  try {
    const apiToken = process.env.TSE_API_TOKEN || '93|Cfcmi2cqLV3eITYWqf1aesfr8VMAzPsTcbK0rKFJf64f8e4e';
    const baseUrl = process.env.TSE_API_URL || 'https://tse.apifycr.com/api/v2/cedula';
    const targetUrl = `${baseUrl}?cedula=${cleanId}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      return NextResponse.json({ success: false, error: `Error en el servicio del Registro Civil (${response.status})` }, { status: response.status });
    }

    const json = await response.json();

    const payload = json.data ? (Array.isArray(json.data) ? json.data[0] : json.data) 
      : (json.results ? json.results[0] : json);

    if (!payload) {
      return NextResponse.json({ success: false, error: 'No se encontró la cédula en la base de datos.' }, { status: 404 });
    }

    const toTitleCase = (str: string) => str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());

    let rawFirstName = payload.nombre || payload.firstname || payload.firstName || payload.nombres || '';
    let rawLastName = payload.apellido1 || payload.primer_apellido || payload.primerApellido || payload.lastname || payload.lastName || payload.paterno || '';
    let rawSecondLastName = payload.apellido2 || payload.segundo_apellido || payload.segundoApellido || payload.lastname2 || payload.secondLastName || payload.materno || '';
    let rawFullName = payload.fullname || payload.nombre_completo || payload.nombreCompleto || payload.name || '';

    if (!rawFirstName && rawFullName) {
      const parts = rawFullName.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 3) {
        rawSecondLastName = parts.pop() || '';
        rawLastName = parts.pop() || '';
        rawFirstName = parts.join(' ');
      } else if (parts.length === 2) {
        rawFirstName = parts[0];
        rawLastName = parts[1];
      } else {
        rawFirstName = parts[0] || '';
      }
    }

    const firstName = toTitleCase(rawFirstName.trim());
    const lastName = toTitleCase(rawLastName.trim());
    const secondLastName = toTitleCase(rawSecondLastName.trim());
    const constructedFullName = [firstName, lastName, secondLastName].filter(Boolean).join(' ').trim();

    if (!constructedFullName) {
      return NextResponse.json({ success: false, error: 'No se pudo obtener el nombre completo.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      fullName: constructedFullName,
      firstName,
      lastName,
      secondLastName,
      raw: payload
    });

  } catch (err: any) {
    console.error('Error proxying TSE API:', err);
    return NextResponse.json({ success: false, error: err.message || 'Error de conexión con el servidor.' }, { status: 500 });
  }
}
