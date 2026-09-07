import nodemailer from 'nodemailer';

/**
 * Minimal SMTP mail integration — there was no email-sending capability
 * anywhere in this codebase before the admin panel, so this is new. Uses
 * whatever SMTP account the operator configures (Gmail, Outlook, a
 * transactional provider's SMTP endpoint, etc.) via env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * If these aren't set, sendMail throws — callers (adminRouter.ts) catch this
 * and still complete the underlying action (e.g. approval), surfacing the
 * generated password in the admin UI as a fallback so an admin can relay it
 * manually rather than the whole approval failing because email isn't
 * configured yet.
 */

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing).');
  }

  const port = Number(SMTP_PORT) || 587;
  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cachedTransporter;
}

export async function sendSupportWorkerCredentials(
  toEmail: string,
  name: string,
  temporaryPassword: string
): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Your AURA counselor account has been approved',
    text: `Hi ${name},\n\nYour AURA counselor application has been approved. You can now sign in with:\n\nEmail: ${toEmail}\nTemporary password: ${temporaryPassword}\n\nPlease sign in and change your password as soon as possible.\n\n— AURA`,
    html: `<p>Hi ${name},</p><p>Your AURA counselor application has been approved. You can now sign in with:</p><p><strong>Email:</strong> ${toEmail}<br/><strong>Temporary password:</strong> ${temporaryPassword}</p><p>Please sign in and change your password as soon as possible.</p><p>— AURA</p>`,
  });
}

export async function sendSupportWorkerRejection(
  toEmail: string,
  name: string,
  reason?: string
): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Update on your AURA counselor application',
    text: `Hi ${name},\n\nThank you for your interest in becoming an AURA counselor. After review, we're unable to approve your application at this time.${reason ? `\n\nReason: ${reason}` : ''}\n\n— AURA`,
  });
}

export async function sendPasswordReset(toEmail: string, name: string, temporaryPassword: string): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Your AURA password has been reset',
    text: `Hi ${name},\n\nAn administrator has reset your AURA password.\n\nEmail: ${toEmail}\nNew temporary password: ${temporaryPassword}\n\nPlease sign in and change your password as soon as possible.\n\n— AURA`,
  });
}
