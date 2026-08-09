INSERT INTO config_sistema (clave, valor, descripcion) VALUES
  ('support.telefono', '+528001234567', 'Teléfono de soporte público'),
  ('support.whatsapp', '+528001234567', 'WhatsApp de soporte público'),
  ('support.email', 'hola@expressmx.com', 'Email público de soporte')
ON CONFLICT (clave) DO NOTHING;
