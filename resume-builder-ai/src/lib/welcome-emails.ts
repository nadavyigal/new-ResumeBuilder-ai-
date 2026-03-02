import { DOMAIN } from './email';

interface EmailInput {
  firstName?: string;
}

interface EmailOutput {
  subject: string;
  html: string;
}

const UTM_BASE = 'utm_source=email&utm_medium=lifecycle&utm_campaign=welcome_sequence';

/**
 * Email 1: Welcome + Quick Wins (sent on D0, immediately)
 */
export function welcomeEmail({ firstName }: EmailInput): EmailOutput {
  const name = firstName || 'there';
  return {
    subject: "Your ATS score is ready. Here's what to fix first.",
    html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">

    <p style="font-size: 16px;">Hi ${name},</p>

    <p>Welcome to Resumely.</p>

    <p>You now have access to your full ATS optimization workflow. The fastest path to better results is straightforward:</p>

    <ol style="line-height: 2; padding-left: 20px;">
        <li><strong>Open your latest ATS check</strong></li>
        <li><strong>Fix the top blockers first</strong></li>
        <li><strong>Apply changes before your next application</strong></li>
    </ol>

    <p>Do not try to rewrite everything at once. Start with the highest-impact edits and keep moving.</p>

    <h2 style="color: #2563eb; margin-top: 30px; font-size: 20px;">3 Quick Fixes That Move the Needle</h2>

    <div style="background: #f8fafc; padding: 16px 20px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 8px 0;"><strong>1. Clarify your target role in the summary</strong> (5 min)<br>
        <span style="color: #4b5563;">If your summary reads like a generic bio, rewrite it around the specific role you are applying for.</span></p>

        <p style="margin: 8px 0;"><strong>2. Mirror key terms from the job description</strong> (15 min)<br>
        <span style="color: #4b5563;">Find 5 exact terms from the posting and match them word-for-word in your resume.</span></p>

        <p style="margin: 8px 0;"><strong>3. Rewrite 3 bullets for measurable impact</strong> (15 min)<br>
        <span style="color: #4b5563;">Replace task descriptions with outcomes.</span></p>
    </div>

    <p>After making changes, re-run your ATS check to confirm they are reflected. You can run unlimited checks for free.</p>

    <p style="text-align: center; margin: 30px 0;">
        <a href="https://${DOMAIN}/?${UTM_BASE}&utm_content=email1_cta"
           style="background: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 15px;">
            Continue Your Optimization
        </a>
    </p>

    <p>If you want, reply to this email with your target role. We can suggest what to prioritize first.</p>

    <p style="margin-top: 24px;">&mdash; The Resumely Team</p>

    <p style="font-size: 13px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <strong>P.S.</strong> In your next email (in 3 days), we will share the most common ATS mistake we see and exactly how to fix it.
    </p>

</body>
</html>`,
  };
}

/**
 * Email 2: Value + Customization (sent on D3)
 */
export function valueEmail({ firstName }: EmailInput): EmailOutput {
  const name = firstName || 'there';
  return {
    subject: 'The resume mistake that costs the most interviews',
    html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">

    <p style="font-size: 16px;">Hi ${name},</p>

    <p>Quick check-in: have you had a chance to apply those fixes from the last email?</p>

    <p>Today, one specific pattern worth flagging. It is the most common blocker we see across ATS checks:</p>

    <h2 style="color: #dc2626; margin-top: 24px; font-size: 20px;">Using the same resume for every application.</h2>

    <p>Here is why it matters:</p>

    <p>A resume written for "Marketing Manager" will match differently against three related but distinct roles:</p>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <tr style="background: #fef2f2;">
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;"><strong>Digital Marketing Manager</strong></td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">Needs SEO, PPC, analytics terms</td>
        </tr>
        <tr style="background: #fefce8;">
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;"><strong>Content Marketing Manager</strong></td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">Needs editorial, storytelling, CMS terms</td>
        </tr>
        <tr style="background: #f0fdf4;">
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;"><strong>Growth Marketing Manager</strong></td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">Needs A/B testing, conversion, data terms</td>
        </tr>
    </table>

    <p>Same qualifications. Same experience. But different emphasis and keywords. When ATS scans for role-specific terms and does not find them, even strong candidates get filtered.</p>

    <h2 style="color: #2563eb; margin-top: 28px; font-size: 20px;">The 15-Minute Customization Checklist</h2>

    <p>Before each application:</p>

    <div style="background: #f8fafc; padding: 16px 20px; border-radius: 8px; margin: 16px 0;">
        <ol style="line-height: 2.2; padding-left: 20px; margin: 0;">
            <li>Read the job description and highlight 8-10 key requirements</li>
            <li>Update your summary to reflect the specific role title</li>
            <li>Reorder your Skills section so relevant items appear first</li>
            <li>Rewrite 3-5 experience bullets using their language</li>
            <li>Run an ATS check to confirm the match improved</li>
        </ol>
    </div>

    <p>15 minutes of tailoring per application is the difference between being filtered out and reaching a recruiter.</p>

    <div style="background: #f0fdf4; padding: 16px; border-left: 4px solid #16a34a; margin: 24px 0;">
        <p style="margin: 0;"><strong>The math:</strong> 20 tailored applications with higher match rates will generate more interviews than 50 generic submissions. Less time. Better targeting. More responses.</p>
    </div>

    <p>Try it now: run a new ATS check with a different job description and compare scores.</p>

    <p style="text-align: center; margin: 30px 0;">
        <a href="https://${DOMAIN}/?${UTM_BASE}&utm_content=email2_cta"
           style="background: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 15px;">
            Run a New ATS Check
        </a>
    </p>

    <p>Keep optimizing,</p>

    <p style="margin-top: 24px;">&mdash; The Resumely Team</p>

    <p style="font-size: 13px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <strong>P.S.</strong> In 4 days, we will share how our Premium tools can save you time on this customization process. But for now, the checklist above works with any resume.
    </p>

</body>
</html>`,
  };
}

/**
 * Email 3: Premium Conversion (sent on D7)
 */
export function conversionEmail({ firstName }: EmailInput): EmailOutput {
  const name = firstName || 'Hi';
  return {
    subject: 'What changes when you upgrade your resume workflow',
    html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">

    <p style="font-size: 16px;">${name},</p>

    <p>Over the past week, you have had access to free ATS checks and the optimization tips we shared. That workflow alone puts you ahead of most applicants.</p>

    <p>Today, a quick overview of what Premium adds on top of that.</p>

    <h2 style="color: #2563eb; margin-top: 24px; font-size: 20px;">The Customization Problem</h2>

    <p>You know from our last email that tailoring your resume for each role makes a real difference. The challenge is doing that efficiently when you are applying to multiple positions.</p>

    <p>That is the problem Premium solves.</p>

    <h2 style="color: #2563eb; margin-top: 24px; font-size: 20px;">What Premium Includes</h2>

    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top; width: 28px; color: #2563eb; font-weight: bold;">1.</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                    <strong>AI-Powered Optimization</strong><br>
                    <span style="color: #4b5563;">Paste a job description and get role-specific resume suggestions in seconds.</span>
                </td>
            </tr>
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top; color: #2563eb; font-weight: bold;">2.</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                    <strong>ATS-Safe Templates</strong><br>
                    <span style="color: #4b5563;">Professional designs that are fully parseable by every major ATS.</span>
                </td>
            </tr>
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top; color: #2563eb; font-weight: bold;">3.</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                    <strong>PDF + DOCX Export</strong><br>
                    <span style="color: #4b5563;">Download your optimized resume in any format with clean formatting.</span>
                </td>
            </tr>
            <tr>
                <td style="padding: 10px 0; vertical-align: top; color: #2563eb; font-weight: bold;">4.</td>
                <td style="padding: 10px 0;">
                    <strong>Unlimited Optimizations</strong><br>
                    <span style="color: #4b5563;">Optimize for every role you apply to. No caps, no limits.</span>
                </td>
            </tr>
        </table>
    </div>

    <h2 style="color: #2563eb; margin-top: 24px; font-size: 20px;">How It Works in Practice</h2>

    <div style="background: #eff6ff; padding: 16px 20px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0; color: #1e40af;"><strong>Without Premium (manual process):</strong></p>
        <p style="margin: 0; color: #374151;">Read JD, manually identify keywords, rewrite bullets, guess at formatting.</p>
        <p style="margin: 12px 0 0 0; font-size: 13px; color: #6b7280;">Time per application: 30-45 minutes</p>
    </div>

    <div style="background: #f0fdf4; padding: 16px 20px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0; color: #166534;"><strong>With Premium:</strong></p>
        <p style="margin: 0; color: #374151;">Paste JD, get suggestions, apply edits, export in ATS-safe template, verify.</p>
        <p style="margin: 12px 0 0 0; font-size: 13px; color: #6b7280;">Time per application: 10-15 minutes</p>
    </div>

    <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 28px; border-radius: 10px; text-align: center; margin: 28px 0;">
        <p style="color: white; font-size: 14px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Launch Pricing</p>
        <p style="color: white; font-size: 36px; font-weight: bold; margin: 0 0 4px 0;">$9<span style="font-size: 16px; font-weight: normal;">/month</span></p>
        <p style="color: #c7d2fe; margin: 0 0 20px 0; font-size: 14px;">Regular price: $19/month</p>
        <a href="https://${DOMAIN}/auth/signup?${UTM_BASE}&utm_content=email3_cta"
           style="background: white; color: #2563eb; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 15px;">
            Try Premium at $9/month
        </a>
    </div>

    <p>If Premium is not the right fit right now, no problem. Your free ATS checks remain unlimited, and the tips we share in these emails work with any resume.</p>

    <p>Either way, keep tailoring and keep applying.</p>

    <p style="margin-top: 24px;">&mdash; The Resumely Team</p>

    <p style="font-size: 13px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <strong>P.S.</strong> If the free ATS checker has been useful, consider sharing it with someone who is job searching. Here is the link: <a href="https://${DOMAIN}/?${UTM_BASE}&utm_content=email3_referral" style="color: #2563eb;">resumelybuilderai.com</a>
    </p>

</body>
</html>`,
  };
}

/**
 * Sequence definition used by the cron job
 */
export const WELCOME_SEQUENCE = [
  { tag: 'welcome_d0', minAgeDays: 0, getEmail: welcomeEmail },
  { tag: 'welcome_d3', minAgeDays: 3, getEmail: valueEmail },
  { tag: 'welcome_d7', minAgeDays: 7, getEmail: conversionEmail },
] as const;
