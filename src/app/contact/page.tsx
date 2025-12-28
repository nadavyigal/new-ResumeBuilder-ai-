import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the Resumely team',
};

export default function ContactPage() {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-6">Contact Us</h1>

      <div className="space-y-6">
        <p className="text-lg text-foreground/70">
          Have questions or feedback? We'd love to hear from you!
        </p>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Email</h2>
            <a
              href="mailto:resumebuilderaiteam@gmail.com"
              className="text-blue-600 hover:underline"
            >
              resumebuilderaiteam@gmail.com
            </a>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Support</h2>
            <p className="text-foreground/70">
              For technical support or account issues, please email us at the address above.
              We typically respond within 24 hours.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Feature Requests</h2>
            <p className="text-foreground/70">
              Have an idea for a new feature? We're always looking to improve.
              Send us your suggestions via email.
            </p>
          </div>
        </div>

        <div className="mt-8 p-6 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Quick Links</h3>
          <ul className="space-y-2">
            <li><a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a></li>
            <li><a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a></li>
            <li><a href="/blog" className="text-blue-600 hover:underline">Blog</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
