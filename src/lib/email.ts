import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Configuration
const FROM_EMAIL = 'resumebuilderaiteam@gmail.com';
const DOMAIN = 'resumelybuilderai.com';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Send an email using Resend
 */
export async function sendEmail({ to, subject, html, replyTo }: SendEmailOptions) {
  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      replyTo,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}

/**
 * Send a welcome email to a new newsletter subscriber
 */
export async function sendNewsletterWelcomeEmail(email: string, name?: string) {
  const displayName = name || 'there';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Resume Builder AI</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Resume Builder AI!</h1>
      </div>

      <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hi ${displayName},</p>

        <p style="font-size: 16px; margin-bottom: 20px;">
          Thank you for subscribing to the Resume Builder AI newsletter! We're excited to have you join our community.
        </p>

        <p style="font-size: 16px; margin-bottom: 20px;">
          Here's what you can expect from us:
        </p>

        <ul style="font-size: 16px; margin-bottom: 20px; padding-left: 20px;">
          <li style="margin-bottom: 10px;"><strong>Resume Tips & Tricks:</strong> Expert advice to make your resume stand out</li>
          <li style="margin-bottom: 10px;"><strong>AI Updates:</strong> Latest features and improvements to our AI optimizer</li>
          <li style="margin-bottom: 10px;"><strong>Career Insights:</strong> Job market trends and career development tips</li>
          <li style="margin-bottom: 10px;"><strong>Exclusive Offers:</strong> Special discounts and early access to new features</li>
        </ul>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://${DOMAIN}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Get Started with AI Resume Optimization
          </a>
        </div>

        <p style="font-size: 16px; margin-bottom: 20px;">
          Need help getting started? Check out our <a href="https://${DOMAIN}/help" style="color: #667eea; text-decoration: none;">Help Center</a> or reply to this email with any questions.
        </p>

        <p style="font-size: 16px; margin-bottom: 20px;">
          Best regards,<br>
          <strong>The Resume Builder AI Team</strong>
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          You're receiving this email because you subscribed to the Resume Builder AI newsletter.
          <br>
          <a href="https://${DOMAIN}/unsubscribe" style="color: #667eea; text-decoration: none;">Unsubscribe</a> |
          <a href="https://${DOMAIN}/privacy" style="color: #667eea; text-decoration: none;">Privacy Policy</a>
        </p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: '🎉 Welcome to Resume Builder AI Newsletter!',
    html,
    replyTo: FROM_EMAIL,
  });
}

/**
 * Send a confirmation email after user signs up
 */
export async function sendSignupConfirmationEmail(email: string, name: string) {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Created Successfully</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Account Created!</h1>
      </div>

      <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hi ${name},</p>

        <p style="font-size: 16px; margin-bottom: 20px;">
          Your Resume Builder AI account has been created successfully! 🎉
        </p>

        <p style="font-size: 16px; margin-bottom: 20px;">
          You can now start optimizing your resume with AI-powered insights to land your dream job.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://${DOMAIN}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Go to Dashboard
          </a>
        </div>

        <p style="font-size: 16px; margin-bottom: 20px;">
          Best regards,<br>
          <strong>The Resume Builder AI Team</strong>
        </p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: '✅ Your Resume Builder AI Account is Ready!',
    html,
  });
}

// Export constants for use in other parts of the app
export { FROM_EMAIL, DOMAIN };
