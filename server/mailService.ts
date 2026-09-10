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

/**
 * Tells a counsellor that one of their cases needs attention.
 *
 * Deliberately plain and specific: a subject line naming the window, a body
 * listing the facts behind it. Anyone reading this on a phone between
 * appointments needs to know whether to act before they finish the first
 * sentence.
 *
 * Never contains a participant's own words — only the counsellor-visible
 * facts the escalation was drawn from.
 */
export async function sendEscalationDigest(
  toEmail: string,
  workerName: string,
  cases: Array<{
    participantId: string;
    participantName?: string;
    headline: string;
    withinHours: number | null;
    evidence: string[];
  }>
): Promise<void> {
  if (!cases.length) return;
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const soonest = cases.reduce(
    (min, c) => (c.withinHours !== null && c.withinHours < min ? c.withinHours : min),
    Number.POSITIVE_INFINITY
  );
  const window = Number.isFinite(soonest) ? `${soonest}h` : '';

  const lines = cases
    .map((c) => {
      const who = c.participantName || c.participantId;
      const bullets = c.evidence.map((e) => `    - ${e}`).join('\n');
      return `${who} — ${c.headline}\n${bullets}`;
    })
    .join('\n\n');

  const html = cases
    .map((c) => {
      const who = c.participantName || c.participantId;
      const bullets = c.evidence.map((e) => `<li>${e}</li>`).join('');
      return `<p><strong>${who}</strong> — ${c.headline}</p><ul>${bullets}</ul>`;
    })
    .join('');

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: `AURA: ${cases.length} case${cases.length === 1 ? '' : 's'} need attention${
      window ? ` (soonest within ${window})` : ''
    }`,
    text: `Hi ${workerName},\n\nAURA has flagged the following from your caseload:\n\n${lines}\n\nThese are prompts for you to decide, not instructions, and nobody has been contacted on your behalf.\n\n— AURA`,
    html: `<p>Hi ${workerName},</p><p>AURA has flagged the following from your caseload:</p>${html}<p>These are prompts for you to decide, not instructions, and nobody has been contacted on your behalf.</p><p>— AURA</p>`,
  });
}
