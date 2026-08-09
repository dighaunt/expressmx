import { Resend } from 'resend';
import { getPublicAppUrl } from '@/lib/app-url';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} environment variable is required`);
  }
  return value;
}

function getResend() {
  return new Resend(requireEnv('RESEND_API_KEY'));
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const from = requireEnv('EMAIL_FROM');
  const appUrl = getPublicAppUrl();
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await getResend().emails.send({
    from,
    to: email,
    subject: 'Recuperación de contraseña — ExpressMX',
    html: `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 16px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
                  <tr>
                    <td align="center" style="padding-bottom:32px;">
                      <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;background-color:#2563eb;border-radius:12px;">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                      </div>
                      <p style="color:#94a3b8;font-size:13px;margin:8px 0 0;">Panel Administrativo</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color:#1e293b;border-radius:12px;border:1px solid #334155;padding:32px;">
                      <h1 style="color:#f8fafc;font-size:20px;font-weight:600;margin:0 0 8px;">Recupera tu contraseña</h1>
                      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.6;">
                        Recibimos una solicitud para restablecer la contraseña de tu cuenta de administrador. El enlace es válido por <strong style="color:#e2e8f0;">1 hora</strong>.
                      </p>
                      <a href="${resetUrl}" style="display:block;background-color:#2563eb;color:#ffffff;text-decoration:none;text-align:center;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">
                        Restablecer contraseña
                      </a>
                      <p style="color:#64748b;font-size:12px;margin:24px 0 0;line-height:1.6;">
                        Si no solicitaste este cambio, ignora este correo. Tu contraseña no será modificada.
                      </p>
                      <hr style="border:none;border-top:1px solid #334155;margin:24px 0;" />
                      <p style="color:#475569;font-size:11px;margin:0;word-break:break-all;">
                        O copia este enlace en tu navegador:<br/>
                        <span style="color:#3b82f6;">${resetUrl}</span>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top:24px;">
                      <p style="color:#475569;font-size:11px;margin:0;">ExpressMX · Plataforma de servicios a domicilio</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}

export async function sendVerificationCodeEmail(email: string, codigo: string) {
  const from = requireEnv('EMAIL_FROM');

  await getResend().emails.send({
    from,
    to: email,
    subject: `Tu código ExpressMX: ${codigo}`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">
                  <tr>
                    <td style="background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;padding:32px;">
                      <h1 style="color:#18181b;font-size:18px;font-weight:600;margin:0 0 8px;">Tu código de verificación</h1>
                      <p style="color:#52525b;font-size:14px;margin:0 0 24px;line-height:1.6;">
                        Usa este código para confirmar tu correo en ExpressMX. Es válido por <strong style="color:#18181b;">15 minutos</strong>.
                      </p>
                      <div style="background-color:#f4f4f5;border-radius:8px;padding:24px;text-align:center;margin:0 0 16px;">
                        <span style="color:#18181b;font-size:32px;font-weight:700;letter-spacing:8px;font-family:'SF Mono',Monaco,Consolas,monospace;">${codigo}</span>
                      </div>
                      <p style="color:#71717a;font-size:12px;margin:16px 0 0;line-height:1.6;">
                        Si no solicitaste este código, ignora este correo. Nadie puede acceder a tu cuenta sin él.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top:24px;">
                      <p style="color:#a1a1aa;font-size:11px;margin:0;">ExpressMX</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}

export function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
