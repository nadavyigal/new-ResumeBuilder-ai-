import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Resumely',
  description: 'Privacy policy for Resumely - AI Resume Optimizer',
};

export default function PrivacyPolicy() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <div className="prose prose-lg max-w-none">
        <p className="text-foreground/70 mb-8">Last updated: December 23, 2025</p>

        <p className="mb-6">
          At Resumely, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered resume optimization service.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">1. Information We Collect</h2>

        <h3 className="text-xl font-semibold mt-6 mb-3">Information you provide to us:</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>Account information:</strong> Name, email address, and password when you create an account</li>
          <li><strong>Resume data:</strong> Resume files and content you upload for optimization</li>
          <li><strong>Job descriptions:</strong> Job description text you input for comparison</li>
          <li><strong>Payment information:</strong> Payment details processed securely via Stripe (we do not store credit card numbers)</li>
          <li><strong>Communications:</strong> Messages you send us and newsletter subscriptions</li>
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-3">Information collected automatically:</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>Usage data:</strong> Pages visited, features used, time spent on our platform</li>
          <li><strong>Device information:</strong> Browser type, operating system, IP address</li>
          <li><strong>Analytics data:</strong> Collected via Google Analytics and PostHog for service improvement</li>
        </ul>

        <h2 className="text-2xl font-bold mt-8 mb-4">2. How We Use Your Information</h2>
        <p className="mb-4">We use the information we collect to:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Provide and improve our AI resume optimization service</li>
          <li>Generate personalized resume suggestions using AI technology</li>
          <li>Calculate ATS compatibility scores for your resume</li>
          <li>Send you transactional emails (account confirmations, service updates)</li>
          <li>Send marketing communications (with your consent, opt-out available)</li>
          <li>Analyze usage patterns to improve our product and user experience</li>
          <li>Prevent fraud and ensure platform security</li>
          <li>Comply with legal obligations and enforce our Terms of Service</li>
        </ul>

        <h2 className="text-2xl font-bold mt-8 mb-4">3. Data Security</h2>
        <p className="mb-4">We implement industry-standard security measures to protect your data:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>Encryption in transit:</strong> All data transmitted using HTTPS/TLS encryption</li>
          <li><strong>Encryption at rest:</strong> Sensitive data encrypted in our database</li>
          <li><strong>Secure authentication:</strong> Password hashing and secure session management via Supabase Auth</li>
          <li><strong>Access controls:</strong> Strict role-based access to user data</li>
          <li><strong>Regular security audits:</strong> Ongoing monitoring and security assessments</li>
        </ul>
        <p className="mb-6">
          However, no method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">4. Third-Party Services</h2>
        <p className="mb-4">We use the following third-party services to operate Resumely:</p>

        <div className="mb-6">
          <h3 className="text-xl font-semibold mt-6 mb-3">Analytics and tracking:</h3>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>Google Analytics:</strong> Website analytics and user behavior tracking (<a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>)</li>
            <li><strong>PostHog:</strong> Product analytics and feature usage tracking (<a href="https://posthog.com/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>)</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">Core services:</h3>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>OpenAI:</strong> AI-powered resume optimization and suggestions (<a href="https://openai.com/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>)</li>
            <li><strong>Supabase:</strong> Database storage and user authentication (<a href="https://supabase.com/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>)</li>
            <li><strong>Resend:</strong> Transactional email delivery (<a href="https://resend.com/legal/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</a>)</li>
            <li><strong>Stripe:</strong> Secure payment processing (<a href="https://stripe.com/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>)</li>
          </ul>
        </div>

        <h2 className="text-2xl font-bold mt-8 mb-4">5. Data Retention</h2>
        <p className="mb-6">
          We retain your personal information for as long as your account is active or as needed to provide you services. If you delete your account, we will delete your personal data within 30 days, except where retention is required by law or for legitimate business purposes (e.g., fraud prevention, resolving disputes).
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">6. Your Rights and Choices</h2>
        <p className="mb-4">You have the following rights regarding your personal data:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>Access:</strong> Request a copy of your personal data</li>
          <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
          <li><strong>Deletion:</strong> Request deletion of your account and personal data</li>
          <li><strong>Portability:</strong> Request your data in a machine-readable format</li>
          <li><strong>Opt-out:</strong> Unsubscribe from marketing emails at any time</li>
          <li><strong>Object:</strong> Object to processing of your data for certain purposes</li>
        </ul>
        <p className="mb-6">
          To exercise these rights, contact us at <a href="mailto:resumebuilderaiteam@gmail.com" className="text-blue-600 hover:underline">resumebuilderaiteam@gmail.com</a>
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">7. Cookies and Tracking Technologies</h2>
        <p className="mb-4">We use cookies and similar tracking technologies to:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Maintain your login session</li>
          <li>Remember your preferences</li>
          <li>Analyze usage patterns and improve our service</li>
          <li>Provide personalized content</li>
        </ul>
        <p className="mb-6">
          You can control cookies through your browser settings. Note that disabling cookies may affect the functionality of our service.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">8. Children's Privacy</h2>
        <p className="mb-6">
          Our service is not intended for individuals under the age of 16. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">9. International Data Transfers</h2>
        <p className="mb-6">
          Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. By using our service, you consent to the transfer of your information to the United States and other countries where we operate.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">10. Changes to This Privacy Policy</h2>
        <p className="mb-6">
          We may update this Privacy Policy from time to time. We will notify you of material changes by email or through a prominent notice on our website. Your continued use of our service after changes become effective constitutes acceptance of the updated Privacy Policy.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">11. Contact Us</h2>
        <p className="mb-4">If you have questions or concerns about this Privacy Policy or our data practices, please contact us:</p>
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
          <p className="mb-2"><strong>Email:</strong> <a href="mailto:resumebuilderaiteam@gmail.com" className="text-blue-600 hover:underline">resumebuilderaiteam@gmail.com</a></p>
          <p className="mb-2"><strong>Website:</strong> <a href="https://resumelybuilderai.com" className="text-blue-600 hover:underline">resumelybuilderai.com</a></p>
        </div>

        <h2 className="text-2xl font-bold mt-8 mb-4">12. GDPR Compliance (EU Users)</h2>
        <p className="mb-4">If you are located in the European Economic Area (EEA), you have additional rights under the General Data Protection Regulation (GDPR):</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Right to withdraw consent at any time</li>
          <li>Right to lodge a complaint with a supervisory authority</li>
          <li>Right to restriction of processing</li>
          <li>Right to object to automated decision-making</li>
        </ul>
        <p className="mb-6">
          Our legal basis for processing your data includes: consent, contractual necessity, legitimate interests, and legal compliance.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">13. California Privacy Rights (CCPA)</h2>
        <p className="mb-4">California residents have specific rights under the California Consumer Privacy Act (CCPA):</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Right to know what personal information is collected</li>
          <li>Right to know if personal information is sold or disclosed</li>
          <li>Right to opt-out of the sale of personal information (we do not sell your data)</li>
          <li>Right to deletion of personal information</li>
          <li>Right to non-discrimination for exercising CCPA rights</li>
        </ul>

        <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-foreground/70">
            This Privacy Policy is effective as of December 23, 2025. By using Resumely, you acknowledge that you have read and understood this Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
