import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-muted-foreground mt-2">Last updated: January 2026</p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-8 p-4 bg-muted rounded-lg">
          <h2 className="font-semibold mb-3 text-foreground">Contents</h2>
          <ul className="space-y-2 text-sm">
            <li><a href="#introduction" className="text-primary hover:underline">1. Introduction</a></li>
            <li><a href="#information-collected" className="text-primary hover:underline">2. Information We Collect</a></li>
            <li><a href="#how-we-use" className="text-primary hover:underline">3. How We Use Your Information</a></li>
            <li><a href="#third-party" className="text-primary hover:underline">4. Third-Party Services</a></li>
            <li><a href="#data-security" className="text-primary hover:underline">5. Data Security</a></li>
            <li><a href="#data-retention" className="text-primary hover:underline">6. Data Retention</a></li>
            <li><a href="#your-rights" className="text-primary hover:underline">7. Your Rights</a></li>
            <li><a href="#cookies" className="text-primary hover:underline">8. Cookies and Tracking</a></li>
            <li><a href="#contact" className="text-primary hover:underline">9. Contact Information</a></li>
            <li><a href="#updates" className="text-primary hover:underline">10. Updates to This Policy</a></li>
          </ul>
        </nav>

        {/* Content */}
        <ScrollArea className="prose prose-slate dark:prose-invert max-w-none">
          <section id="introduction" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              FUIK COMPANY B.V. ("we," "our," or "us") operates the FUIK.IO platform, a comprehensive 
              distribution and logistics management solution. We are committed to protecting your privacy 
              and ensuring that your personal information is handled in a safe and responsible manner. 
              This Privacy Policy describes how we collect, use, and share information when you use our services.
            </p>
          </section>

          <section id="information-collected" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We collect information that you provide directly to us and information we obtain automatically 
              when you use our services:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Account Information:</strong> Name, email address, phone number, and company details when you create an account.</li>
              <li><strong>Business Data:</strong> Order information, customer records, product inventory, pricing data, and delivery details.</li>
              <li><strong>Financial Information:</strong> Invoicing data, payment records, and accounting information when connected to third-party services like QuickBooks.</li>
              <li><strong>Usage Data:</strong> Information about how you access and use our platform, including log data, device information, and IP addresses.</li>
              <li><strong>Location Data:</strong> Delivery addresses and, with your consent, real-time location for route optimization.</li>
            </ul>
          </section>

          <section id="how-we-use" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>To provide, maintain, and improve our services</li>
              <li>To process orders, deliveries, and invoicing</li>
              <li>To synchronize data with integrated third-party services</li>
              <li>To send you notifications about your account and orders</li>
              <li>To analyze usage patterns and optimize platform performance</li>
              <li>To comply with legal obligations and protect our rights</li>
              <li>To provide customer support and respond to your inquiries</li>
            </ul>
          </section>

          <section id="third-party" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              FUIK.IO integrates with third-party services to provide enhanced functionality:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>QuickBooks Online:</strong> When you connect your QuickBooks account, we access customer data, invoice information, and payment records to synchronize your accounting data. We only access the data necessary to provide the synchronization features you have enabled.</li>
              <li><strong>WhatsApp Business:</strong> For order communication and delivery notifications.</li>
              <li><strong>Mapping Services:</strong> For route optimization and delivery tracking.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Each third-party service has its own privacy policy, and we encourage you to review them. 
              We share only the minimum data necessary to enable these integrations.
            </p>
          </section>

          <section id="data-security" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal information, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
              <li>Encryption of data in transit using TLS/SSL</li>
              <li>Encryption of sensitive data at rest</li>
              <li>Regular security assessments and penetration testing</li>
              <li>Access controls and authentication measures</li>
              <li>Employee training on data protection practices</li>
            </ul>
          </section>

          <section id="data-retention" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal information for as long as necessary to fulfill the purposes for which 
              it was collected, including to satisfy legal, accounting, or reporting requirements. When your 
              data is no longer needed, we will securely delete or anonymize it. Business records may be 
              retained for up to 7 years to comply with Dutch legal requirements.
            </p>
          </section>

          <section id="your-rights" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Under the General Data Protection Regulation (GDPR) and other applicable laws, you have the following rights:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Right to Access:</strong> Request a copy of your personal data.</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate data.</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your personal data under certain circumstances.</li>
              <li><strong>Right to Restrict Processing:</strong> Request limitation of how we use your data.</li>
              <li><strong>Right to Data Portability:</strong> Receive your data in a structured, machine-readable format.</li>
              <li><strong>Right to Object:</strong> Object to processing based on legitimate interests.</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time where processing is based on consent.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              To exercise these rights, please contact us using the information provided below.
            </p>
          </section>

          <section id="cookies" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar tracking technologies to enhance your experience on our platform. 
              These include essential cookies for authentication and security, preference cookies to remember 
              your settings, and analytics cookies to understand how you use our services. You can manage 
              your cookie preferences through your browser settings.
            </p>
          </section>

          <section id="contact" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or wish to exercise your rights, 
              please contact us:
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-foreground font-medium">FUIK COMPANY B.V.</p>
              <p className="text-muted-foreground">Email: privacy@fuik.io</p>
              <p className="text-muted-foreground">Country: The Netherlands</p>
            </div>
          </section>

          <section id="updates" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Updates to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices or 
              applicable laws. We will notify you of any material changes by posting the updated policy 
              on our platform and updating the "Last updated" date at the top of this page. We encourage 
              you to review this policy periodically.
            </p>
          </section>
        </ScrollArea>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            © {new Date().getFullYear()} FUIK COMPANY B.V. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
