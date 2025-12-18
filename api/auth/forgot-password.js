import { cors, handleOptions } from '../_lib/middleware.js';
import sql from '../_lib/db.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email é obrigatório' });
    }

    // Verificar se usuário existe
    const users = await sql`
      SELECT id, name, email FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (users.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'Se o email existir, você receberá um código de recuperação.' 
      });
    }

    const user = users[0];

    // Gerar código de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Salvar código no banco
    await sql`
      UPDATE users 
      SET reset_code = ${resetCode}, 
          reset_code_expires = ${expiresAt}
      WHERE id = ${user.id}
    `;

    // Enviar email
    const { error: emailError } = await resend.emails.send({
      from: 'AdBrain Pro <noreply@metalock.pro>',
      to: [email],
      subject: 'Código de Recuperação - AdBrain Pro',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #0a0a0b; color: #ffffff; padding: 40px 20px;">
          <div style="max-width: 500px; margin: 0 auto; background: #141417; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 28px;">🧠</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; color: #ffffff;">AdBrain Pro</h1>
            </div>
            
            <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6;">
              Olá <strong style="color: #ffffff;">${user.name || 'usuário'}</strong>,
            </p>
            
            <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6;">
              Você solicitou a recuperação de senha. Use o código abaixo para criar uma nova senha:
            </p>
            
            <div style="background: #0a0a0b; border: 2px solid #10b981; border-radius: 12px; padding: 24px; text-align: center; margin: 30px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #10b981;">${resetCode}</span>
            </div>
            
            <p style="color: #71717a; font-size: 13px; text-align: center;">
              ⏰ Este código expira em <strong>15 minutos</strong>
            </p>
            
            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 30px 0;">
            
            <p style="color: #71717a; font-size: 12px; text-align: center; margin: 0;">
              Se você não solicitou esta recuperação, ignore este email.<br>
              Sua senha permanecerá a mesma.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (emailError) {
      console.error('Erro ao enviar email:', emailError);
      return res.status(500).json({ success: false, error: 'Erro ao enviar email' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Código de recuperação enviado para seu email!' 
    });

  } catch (error) {
    console.error('Erro no forgot-password:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
