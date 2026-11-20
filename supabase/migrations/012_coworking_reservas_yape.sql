-- ============================================================================
-- MIGRACIÓN 012: Mesas Coworking / Reuniones, Pago Yape In-App y Recordatorios
-- ============================================================================

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS yape_numero TEXT DEFAULT '+51 987 111 222',
  ADD COLUMN IF NOT EXISTS yape_titular TEXT DEFAULT 'Olivia Café S.A.C.',
  ADD COLUMN IF NOT EXISTS coworking_activo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS coworking_consumo_minimo_pen NUMERIC(10,2) NOT NULL DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS coworking_tolerancia_min INTEGER NOT NULL DEFAULT 15;

-- Solo 2 o 3 mesas/espacios habilitados por sede (ajustable según demanda en Admin)
CREATE TABLE IF NOT EXISTS espacios_coworking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  sede_id UUID NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  capacidad INTEGER NOT NULL DEFAULT 4 CHECK (capacidad BETWEEN 1 AND 20),
  descripcion TEXT NOT NULL DEFAULT '',
  equipamiento TEXT NOT NULL DEFAULT 'Wi-Fi Fibra · Enchufes',
  consumo_minimo_pen NUMERIC(10,2) NOT NULL DEFAULT 15.00,
  duracion_bloque_min INTEGER NOT NULL DEFAULT 120 CHECK (duracion_bloque_min IN (60, 90, 120, 180)),
  hora_apertura TEXT NOT NULL DEFAULT '08:00',
  hora_cierre TEXT NOT NULL DEFAULT '20:00',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_espacios_coworking_negocio
  ON espacios_coworking (negocio_id, sede_id, activo);

-- Reservas de mesas con pedido mínimo y comprobante Yape dentro de la app
CREATE TABLE IF NOT EXISTS reservas_coworking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  sede_id UUID NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
  espacio_id UUID NOT NULL REFERENCES espacios_coworking(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  codigo_reserva TEXT NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fin TEXT NOT NULL,
  personas INTEGER NOT NULL DEFAULT 2 CHECK (personas BETWEEN 1 AND 20),
  motivo_reunion TEXT NOT NULL DEFAULT '',
  items_pedido JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_pedido_pen NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente_pago'
    CHECK (estado IN ('pendiente_pago', 'yape_por_validar', 'confirmada', 'checkin', 'rechazada', 'cancelada')),
  yape_comprobante_base64 TEXT,
  yape_codigo_operacion TEXT,
  mensaje_pos TEXT,
  recordatorio_enviado BOOLEAN NOT NULL DEFAULT false,
  validado_por_cajero_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservas_coworking_fecha
  ON reservas_coworking (negocio_id, fecha, estado);

CREATE INDEX IF NOT EXISTS idx_reservas_coworking_cliente
  ON reservas_coworking (cliente_id, created_at DESC);

ALTER TABLE espacios_coworking ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas_coworking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica espacios coworking" ON espacios_coworking;
CREATE POLICY "Lectura publica espacios coworking"
  ON espacios_coworking FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin gestiona espacios coworking" ON espacios_coworking;
CREATE POLICY "Admin gestiona espacios coworking"
  ON espacios_coworking FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid()
        AND p.negocio_id = espacios_coworking.negocio_id
        AND p.rol IN ('owner', 'superadmin')
        AND p.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid()
        AND p.negocio_id = espacios_coworking.negocio_id
        AND p.rol IN ('owner', 'superadmin')
        AND p.activo = true
    )
  );

DROP POLICY IF EXISTS "Acceso reservas coworking cliente y local" ON reservas_coworking;
CREATE POLICY "Acceso reservas coworking cliente y local"
  ON reservas_coworking FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Crear reserva coworking" ON reservas_coworking;
CREATE POLICY "Crear reserva coworking"
  ON reservas_coworking FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Actualizar reserva coworking" ON reservas_coworking;
CREATE POLICY "Actualizar reserva coworking"
  ON reservas_coworking FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Seed inicial: 3 mesas habilitadas para Olivia Café (Miraflores y San Isidro)
INSERT INTO espacios_coworking (
  negocio_id,
  sede_id,
  nombre,
  capacidad,
  descripcion,
  equipamiento,
  consumo_minimo_pen,
  duracion_bloque_min,
  hora_apertura,
  hora_cierre,
  activo
)
SELECT
  '11111111-1111-4111-8111-111111111111',
  s.id,
  v.nombre,
  v.capacidad,
  v.descripcion,
  v.equipamiento,
  v.consumo_minimo_pen,
  v.duracion_bloque_min,
  v.hora_apertura,
  v.hora_cierre,
  v.activo
FROM sedes s
JOIN (
  VALUES
    (
      'Local Principal · Miraflores',
      'Mesa Ejecutiva 01 (Reuniones)',
      4,
      'Mesa amplia junto a ventanal iluminado para cerrar acuerdos o reuniones con clientes.',
      'Wi-Fi Fibra 300Mbps · 4 Enchufes · Iluminación natural',
      18.00,
      120,
      '08:00',
      '20:00',
      true
    ),
    (
      'Local Principal · Miraflores',
      'Barra Work & Laptop 02',
      2,
      'Espacio tranquilo con tomas de corriente USB-C y buena acústica para videollamadas.',
      'Wi-Fi Fibra · Tomas múltiples · Zona tranquila',
      13.50,
      120,
      '08:00',
      '20:00',
      true
    ),
    (
      'Barra Express · San Isidro',
      'Mesa Negocios San Isidro 01',
      4,
      'Ubicada a pasos del centro financiero. Ideal para reuniones ejecutivas con café de especialidad.',
      'Wi-Fi Fibra · Enchufes · Atención preferencial',
      20.00,
      90,
      '08:00',
      '19:30',
      true
    )
) AS v(sede_nombre, nombre, capacidad, descripcion, equipamiento, consumo_minimo_pen, duracion_bloque_min, hora_apertura, hora_cierre, activo)
  ON s.negocio_id = '11111111-1111-4111-8111-111111111111'
 AND s.nombre = v.sede_nombre
WHERE NOT EXISTS (
  SELECT 1 FROM espacios_coworking ec
  WHERE ec.negocio_id = '11111111-1111-4111-8111-111111111111'
    AND ec.nombre = v.nombre
);
