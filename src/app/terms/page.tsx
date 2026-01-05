import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | Resumely',
  description: 'Terms of service for Resumely - AI Resume Optimizer',
};

export default function TermsOfService() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <div className="prose prose-lg max-w-none">
        <p className="text-foreground/70 mb-8">Last updated: December 23, 2025</p>

        <p className="mb-6">
          Welcome to Resumely. By accessing or using our AI-powered resume optimization service, you agree to be bound by these Terms of Service. Please read them carefully.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">1. Acceptance of Terms</h2>
        <p className="mb-6">
          By creating an account, accessing, or using Resumely (&quot;Service&quot;, &quot;Platform&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), you agree to comply with and be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use our Service.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">2. Service Description</h2>
        <p className="mb-4">Resumely provides the following AI-powered resume optimization services:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Applicant Tracking System (ATS) compatibility analysis</li>
          <li>Resume content optimization suggestions powered by artificial intelligence</li>
          <li>Job description matching and keyword optimization</li>
          <li>ATS scoring and compatibility metrics</li>
          <li>Professional resume templates optimized for ATS systems</li>
          <li>Resume export functionality (PDF format)</li>
        </ul>
        <p className="mb-6">
          Our Service uses AI technology (powered by OpenAI) to analyze your resume and provide suggestions. Results may vary, and we do not guarantee specific outcomes or job placement.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">3. User Accounts</h2>

        <h3 className="text-xl font-semibold mt-6 mb-3">Account Creation</h3>
        <p className="mb-4">To use certain features of our Service, you must create an account. You agree to:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Provide accurate, current, and complete information during registration</li>
          <li>Maintain and promptly update your account information</li>
          <li>Maintain the security of your account password</li>
          <li>Accept responsibility for all activities under your account</li>
          <li>Immediately notify us of any unauthorized account access</li>
          <li>Not share your account credentials with others</li>
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-3">Account Termination</h3>
        <p className="mb-6">
          We reserve the right to suspend or terminate your account at any time for violation of these Terms, fraudulent activity, or any other reason at our discretion. You may delete your account at any time through your account settings.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">4. Subscription Plans and Payments</h2>

        <h3 className="text-xl font-semibold mt-6 mb-3">Pricing Tiers</h3>
        <div className="mb-6">
          <p className="mb-4">Resumely offers the following pricing plans:</p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>Free Tier:</strong> One (1) resume optimization per user account</li>
            <li><strong>Premium Plan:</strong> $9/month for unlimited resume optimizations, premium templates, and priority support</li>
          </ul>
        </div>

        <h3 className="text-xl font-semibold mt-6 mb-3">Payment Terms</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>All payments are processed securely through Stripe</li>
          <li>Subscriptions renew automatically on a monthly basis unless cancelled</li>
          <li>You authorize us to charge your payment method for all fees due</li>
          <li>Prices are subject to change with 30 days notice</li>
          <li>All fees are non-refundable except as required by law or stated in our refund policy</li>
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-3">Refund Policy</h3>
        <p className="mb-6">
          Premium subscriptions are eligible for a full refund within 7 days of purchase if you are not satisfied with the service. To request a refund, contact us at resumebuilderaiteam@gmail.com with your account details.
        </p>

        <h3 className="text-xl font-semibold mt-6 mb-3">Cancellation</h3>
        <p className="mb-6">
          You may cancel your Premium subscription at any time through your account settings. Cancellation takes effect at the end of your current billing period. You will retain access to Premium features until the end of the paid period.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">5. Acceptable Use Policy</h2>
        <p className="mb-4">You agree NOT to use our Service to:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Violate any applicable laws or regulations</li>
          <li>Upload malicious code, viruses, or harmful content</li>
          <li>Infringe upon intellectual property rights of others</li>
          <li>Harass, abuse, or harm other users</li>
          <li>Attempt to reverse engineer, decompile, or extract our AI models</li>
          <li>Use automated scripts, bots, or scraping tools without permission</li>
          <li>Share, resell, or redistribute our Service without authorization</li>
          <li>Create multiple accounts to circumvent free tier limitations</li>
          <li>Upload resumes or content that you do not have rights to</li>
          <li>Use our Service to create false, misleading, or fraudulent resumes</li>
        </ul>

        <h2 className="text-2xl font-bold mt-8 mb-4">6. Intellectual Property Rights</h2>

        <h3 className="text-xl font-semibold mt-6 mb-3">Your Content</h3>
        <p className="mb-6">
          You retain all ownership rights to your resume content, job descriptions, and other materials you upload to our Service. By uploading content, you grant us a limited license to use, process, and analyze your content solely for the purpose of providing our Service and improving our AI models.
        </p>

        <h3 className="text-xl font-semibold mt-6 mb-3">Our Property</h3>
        <p className="mb-6">
          Resumely, our logo, AI models, algorithms, software, templates, and all related intellectual property are owned by us or our licensors. You may not copy, modify, distribute, or create derivative works without our express written permission.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">7. AI-Generated Content and Suggestions</h2>
        <p className="mb-4">Important disclaimers about our AI-powered service:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>AI-generated suggestions are automated and may contain errors or inaccuracies</li>
          <li>You are responsible for reviewing and verifying all suggestions before use</li>
          <li>AI suggestions should be used as guidance, not absolute rules</li>
          <li>We do not guarantee that AI suggestions will improve your job search outcomes</li>
          <li>You should customize and personalize AI suggestions to match your experience</li>
          <li>Never include false or misleading information in your resume, even if suggested by AI</li>
        </ul>

        <h2 className="text-2xl font-bold mt-8 mb-4">8. Disclaimers and Limitations of Liability</h2>

        <h3 className="text-xl font-semibold mt-6 mb-3">Service Provided &quot;As Is&quot;</h3>
        <p className="mb-6">
          Our Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, secure, or error-free.
        </p>

        <h3 className="text-xl font-semibold mt-6 mb-3">No Employment Guarantee</h3>
        <p className="mb-6">
          <strong>Important:</strong> Resumely provides resume optimization tools and suggestions but does NOT guarantee job interviews, job offers, or employment outcomes. Your success in job searching depends on many factors beyond our Service.
        </p>

        <h3 className="text-xl font-semibold mt-6 mb-3">Limitation of Liability</h3>
        <p className="mb-6">
          To the maximum extent permitted by law, Resumely and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Your use or inability to use the Service</li>
          <li>Any unauthorized access to or use of our servers and/or personal information</li>
          <li>Any errors, mistakes, or inaccuracies in AI-generated content</li>
          <li>Any job search outcomes or lack thereof</li>
        </ul>
        <p className="mb-6">
          Our total liability shall not exceed the amount you paid us in the twelve (12) months preceding the claim.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">9. Indemnification</h2>
        <p className="mb-6">
          You agree to indemnify, defend, and hold harmless Resumely and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from your use of the Service, violation of these Terms, or infringement of any third-party rights.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">10. Data Privacy and Security</h2>
        <p className="mb-6">
          Your use of our Service is also governed by our Privacy Policy, which explains how we collect, use, and protect your personal information. We implement industry-standard security measures, but cannot guarantee absolute security. Please refer to our <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a> for detailed information.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">11. Third-Party Services</h2>
        <p className="mb-6">
          Our Service integrates with third-party services including OpenAI (AI processing), Stripe (payments), and others. Your use of these services may be subject to their respective terms and conditions. We are not responsible for the practices of third-party services.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">12. Changes to Terms</h2>
        <p className="mb-6">
          We reserve the right to modify these Terms at any time. Material changes will be notified via email or through a prominent notice on our website at least 30 days before taking effect. Your continued use of the Service after changes become effective constitutes acceptance of the updated Terms.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">13. Governing Law and Dispute Resolution</h2>
        <p className="mb-6">
          These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law provisions. Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration, except where prohibited by law.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">14. Severability</h2>
        <p className="mb-6">
          If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">15. Entire Agreement</h2>
        <p className="mb-6">
          These Terms, together with our Privacy Policy, constitute the entire agreement between you and Resumely regarding the use of our Service and supersede all prior agreements and understandings.
        </p>

        <h2 className="text-2xl font-bold mt-8 mb-4">16. Contact Information</h2>
        <p className="mb-4">If you have questions about these Terms of Service, please contact us:</p>
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
          <p className="mb-2"><strong>Email:</strong> <a href="mailto:resumebuilderaiteam@gmail.com" className="text-blue-600 hover:underline">resumebuilderaiteam@gmail.com</a></p>
          <p className="mb-2"><strong>Website:</strong> <a href="https://resumelybuilderai.com" className="text-blue-600 hover:underline">resumelybuilderai.com</a></p>
        </div>

        <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-100">
          <p className="font-semibold mb-2">Acknowledgment</p>
          <p className="text-sm text-foreground/70">
            BY USING RESUMELY, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS OF SERVICE. IF YOU DO NOT AGREE TO THESE TERMS, YOU MAY NOT USE OUR SERVICE.
          </p>
        </div>

        <p className="text-sm text-foreground/60 mt-8">
          These Terms of Service are effective as of December 23, 2025.
        </p>
      </div>
    </div>
  );
}
