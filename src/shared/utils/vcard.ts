export interface BusinessVCardInput {
  nombreNegocio: string;
  telefonoWhatsapp: string;
  subtitulo?: string | null;
  sitioUrl?: string;
}

export function downloadBusinessVCard({
  nombreNegocio,
  telefonoWhatsapp,
  subtitulo,
  sitioUrl,
}: BusinessVCardInput): void {
  const cleanPhone = telefonoWhatsapp.replace(/[^\d+]/g, '');
  const org = nombreNegocio.replace(/\n/g, ' ').trim();
  const note = `${subtitulo || 'Club de Lealtad Digital'} — Guarda este contacto para recibir tus premios y regalo de cumpleaños sin spam.`;

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${org}`,
    `ORG:${org}`,
    `TEL;TYPE=CELL,VOICE,WHATSAPP:${cleanPhone}`,
    `NOTE:${note}`,
    sitioUrl ? `URL:${sitioUrl}` : '',
    'END:VCARD',
  ].filter(Boolean);

  const vcfContent = lines.join('\r\n');
  const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${org.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.vcf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
