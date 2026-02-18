import { sendEmail, FROM_EMAIL, DOMAIN } from '@/lib/email';
import type { Feedback, SupportTicket } from '@/types/feedback';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'resumebuilderaiteam@gmail.com';

function emailWrapper(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  ${body}
</body>
</html>`;
}

const feedbackTypeLabel: Record<string, string> = {
  general: 'General Feedback',
  bug: 'Bug Report',
  feature_request: 'Feature Request',
  nps: 'NPS Survey',
  rating: 'Optimization Rating',
};

/**
 * Send an admin alert email when new feedback is submitted.
 */
export async function sendFeedbackAdminAlert(feedback: Feedback, userEmail?: string): Promise<void> {
  const typeLabel = feedbackTypeLabel[feedback.type] ?? feedback.type;
  const ratingText = feedback.rating != null ? ` (${feedback.rating}/10)` : '';
  const messageText = feedback.message
    ? `<p style="background:#f9fafb;padding:16px;border-radius:6px;border-left:4px solid #667eea;">${feedback.message}</p>`
    : '<p style="color:#6b7280;"><em>No message provided</em></p>';

  const contextRows = Object.entries(feedback.context || {})
    .filter(([, v]) => v != null)
    .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#6b7280;font-size:13px;">${k}</td><td style="padding:4px 8px;font-size:13px;">${v}</td></tr>`)
    .join('');

  const contextTable = contextRows
    ? `<table style="width:100%;border-collapse:collapse;margin-top:8px;">${contextRows}</table>`
    : '';

  const dashboardLink = `https://${DOMAIN}/admin/feedback`;

  const body = `
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:24px 20px;text-align:center;border-radius:10px 10px 0 0;">
      <h1 style="color:white;margin:0;font-size:20px;">New ${typeLabel}${ratingText}</h1>
    </div>
    <div style="background:#fff;padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
      ${userEmail ? `<p><strong>From:</strong> ${userEmail}</p>` : '<p><strong>From:</strong> Anonymous user</p>'}
      <p><strong>Type:</strong> ${typeLabel}</p>
      ${feedback.rating != null ? `<p><strong>Rating:</strong> ${feedback.rating}/10</p>` : ''}
      <p><strong>Message:</strong></p>
      ${messageText}
      ${contextRows ? `<p><strong>Context:</strong>${contextTable}</p>` : ''}
      <p><strong>Submitted:</strong> ${new Date(feedback.created_at).toUTCString()}</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${dashboardLink}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">
          View in Admin Dashboard
        </a>
      </div>
    </div>
  `;

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `[Feedback] ${typeLabel}${ratingText} from ${userEmail ?? 'anonymous'}`,
    html: emailWrapper(body),
  });
}

/**
 * Send an admin alert when a new support ticket is created.
 */
export async function sendTicketAdminAlert(ticket: SupportTicket): Promise<void> {
  const dashboardLink = `https://${DOMAIN}/admin/feedback`;

  const priorityColor: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#10b981',
  };
  const priorityBadge = `<span style="display:inline-block;padding:2px 10px;border-radius:9999px;background:${priorityColor[ticket.priority] ?? '#6b7280'};color:white;font-size:12px;font-weight:600;">${ticket.priority.toUpperCase()}</span>`;

  const body = `
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:24px 20px;text-align:center;border-radius:10px 10px 0 0;">
      <h1 style="color:white;margin:0;font-size:20px;">New Support Ticket</h1>
    </div>
    <div style="background:#fff;padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
      <p><strong>From:</strong> ${ticket.name ? `${ticket.name} &lt;${ticket.email}&gt;` : ticket.email}</p>
      <p><strong>Subject:</strong> ${ticket.subject}</p>
      <p><strong>Category:</strong> ${ticket.category}</p>
      <p><strong>Priority:</strong> ${priorityBadge}</p>
      <p><strong>Message:</strong></p>
      <p style="background:#f9fafb;padding:16px;border-radius:6px;border-left:4px solid #667eea;">${ticket.message}</p>
      <p><strong>Submitted:</strong> ${new Date(ticket.created_at).toUTCString()}</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${dashboardLink}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">
          View in Admin Dashboard
        </a>
      </div>
    </div>
  `;

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `[Support] ${ticket.subject} — ${ticket.category} (${ticket.priority})`,
    html: emailWrapper(body),
    replyTo: ticket.email,
  });
}

/**
 * Send an acknowledgement to the user after they submit a support ticket.
 */
export async function sendTicketAcknowledgement(ticket: SupportTicket): Promise<void> {
  const displayName = ticket.name || 'there';

  const body = `
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px 20px;text-align:center;border-radius:10px 10px 0 0;">
      <h1 style="color:white;margin:0;font-size:24px;">We received your message!</h1>
    </div>
    <div style="background:#fff;padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
      <p style="font-size:16px;">Hi ${displayName},</p>
      <p style="font-size:16px;">
        Thanks for reaching out! We've received your support request and will get back to you as soon as possible — usually within 1–2 business days.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:24px 0;">
        <p style="margin:0 0 8px 0;font-weight:600;color:#374151;">Your request details:</p>
        <p style="margin:0;color:#6b7280;font-size:14px;"><strong>Subject:</strong> ${ticket.subject}</p>
        <p style="margin:4px 0 0 0;color:#6b7280;font-size:14px;"><strong>Category:</strong> ${ticket.category}</p>
        <p style="margin:4px 0 0 0;color:#6b7280;font-size:14px;"><strong>Ticket ID:</strong> ${ticket.id.slice(0, 8).toUpperCase()}</p>
      </div>
      <p style="font-size:16px;">
        In the meantime, you can continue using Resume Builder AI to optimize your resume and land your dream job.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="https://${DOMAIN}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:16px;">
          Go to Dashboard
        </a>
      </div>
      <p style="font-size:14px;color:#6b7280;">
        If you have additional info to share, just reply to this email — it will be linked to your ticket.
      </p>
      <p style="font-size:16px;">
        Best regards,<br>
        <strong>The Resume Builder AI Team</strong>
      </p>
    </div>
  `;

  await sendEmail({
    to: ticket.email,
    subject: `[Support] We received your request — ${ticket.subject}`,
    html: emailWrapper(body),
    replyTo: FROM_EMAIL,
  });
}
