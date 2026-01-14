import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

const EULA = () => {
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
          <h1 className="text-3xl font-bold text-foreground">End User License Agreement</h1>
          <p className="text-muted-foreground mt-2">Last updated: January 2026</p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-8 p-4 bg-muted rounded-lg">
          <h2 className="font-semibold mb-3 text-foreground">Contents</h2>
          <ul className="space-y-2 text-sm">
            <li><a href="#agreement" className="text-primary hover:underline">1. Agreement to Terms</a></li>
            <li><a href="#license" className="text-primary hover:underline">2. License Grant</a></li>
            <li><a href="#responsibilities" className="text-primary hover:underline">3. User Responsibilities</a></li>
            <li><a href="#prohibited" className="text-primary hover:underline">4. Prohibited Activities</a></li>
            <li><a href="#intellectual-property" className="text-primary hover:underline">5. Intellectual Property</a></li>
            <li><a href="#integrations" className="text-primary hover:underline">6. Third-Party Integrations</a></li>
            <li><a href="#disclaimers" className="text-primary hover:underline">7. Disclaimers</a></li>
            <li><a href="#liability" className="text-primary hover:underline">8. Limitation of Liability</a></li>
            <li><a href="#termination" className="text-primary hover:underline">9. Termination</a></li>
            <li><a href="#governing-law" className="text-primary hover:underline">10. Governing Law</a></li>
            <li><a href="#contact" className="text-primary hover:underline">11. Contact Information</a></li>
          </ul>
        </nav>

        {/* Content */}
        <ScrollArea className="prose prose-slate dark:prose-invert max-w-none">
          <section id="agreement" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              This End User License Agreement ("Agreement") is a binding legal agreement between you ("User" or "you") 
              and FUIK COMPANY B.V. ("Company," "we," "our," or "us") governing your use of the FUIK.IO platform 
              and all related services ("Service"). By accessing or using the Service, you agree to be bound by this 
              Agreement. If you do not agree to these terms, you may not access or use the Service.
            </p>
          </section>

          <section id="license" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. License Grant</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Subject to your compliance with this Agreement, we grant you a limited, non-exclusive, non-transferable, 
              revocable license to access and use the Service for your internal business purposes. This license does 
              not include:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>The right to sublicense, sell, or redistribute the Service</li>
              <li>The right to modify, adapt, or create derivative works of the Service</li>
              <li>The right to reverse engineer, decompile, or disassemble the Service</li>
              <li>The right to use the Service for any purpose other than as expressly permitted herein</li>
            </ul>
          </section>

          <section id="responsibilities" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. User Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              As a user of FUIK.IO, you are responsible for:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>Ensuring all information you provide is accurate and up-to-date</li>
              <li>Using the Service only for lawful purposes and in compliance with applicable laws</li>
              <li>Obtaining all necessary authorizations before sharing customer or business data</li>
              <li>Notifying us immediately of any unauthorized use of your account</li>
              <li>Complying with all applicable data protection and privacy regulations</li>
            </ul>
          </section>

          <section id="prohibited" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Prohibited Activities</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You may not engage in any of the following prohibited activities:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Attempting to gain unauthorized access to any part of the Service or its systems</li>
              <li>Interfering with or disrupting the integrity or performance of the Service</li>
              <li>Uploading or transmitting viruses, malware, or other malicious code</li>
              <li>Using the Service for any fraudulent, illegal, or unauthorized purpose</li>
              <li>Impersonating any person or entity or misrepresenting your affiliation</li>
              <li>Scraping, data mining, or extracting data from the Service without authorization</li>
              <li>Circumventing any access controls or usage limitations</li>
            </ul>
          </section>

          <section id="intellectual-property" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service, including all content, features, and functionality, is owned by FUIK COMPANY B.V. 
              and is protected by Dutch and international copyright, trademark, patent, and other intellectual 
              property laws. The FUIK.IO name, logo, and all related names, logos, product and service names, 
              designs, and slogans are trademarks of FUIK COMPANY B.V. You may not use these marks without our 
              prior written permission. Your data remains your property, and you grant us only the licenses 
              necessary to provide the Service.
            </p>
          </section>

          <section id="integrations" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Third-Party Integrations</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              FUIK.IO offers integrations with third-party services, including but not limited to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>QuickBooks Online:</strong> For accounting and invoice synchronization. Your use of QuickBooks integration is subject to Intuit's terms of service.</li>
              <li><strong>WhatsApp Business:</strong> For communication features. Subject to Meta's terms of service.</li>
              <li><strong>Other integrations:</strong> As may be offered from time to time, each subject to the applicable third-party terms.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We are not responsible for the availability, accuracy, or content of third-party services. 
              Your use of these integrations is at your own risk and subject to their respective terms.
            </p>
          </section>

          <section id="disclaimers" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Disclaimers</h2>
            <p className="text-muted-foreground leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER 
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, 
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE 
              WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. WE DO NOT GUARANTEE THE ACCURACY, COMPLETENESS, 
              OR RELIABILITY OF ANY DATA PROCESSED THROUGH THE SERVICE. YOU ACKNOWLEDGE THAT YOUR USE OF 
              THE SERVICE IS AT YOUR SOLE RISK.
            </p>
          </section>

          <section id="liability" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL FUIK COMPANY B.V., 
              ITS DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, 
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, 
              USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (I) YOUR ACCESS TO OR USE OF 
              OR INABILITY TO ACCESS OR USE THE SERVICE; (II) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY 
              ON THE SERVICE; (III) ANY CONTENT OBTAINED FROM THE SERVICE; AND (IV) UNAUTHORIZED ACCESS, 
              USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT. OUR TOTAL LIABILITY SHALL NOT EXCEED 
              THE AMOUNT YOU HAVE PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section id="termination" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Termination</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We may terminate or suspend your access to the Service immediately, without prior notice or 
              liability, for any reason, including without limitation if you breach this Agreement. Upon 
              termination:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Your right to use the Service will immediately cease</li>
              <li>You may request export of your data within 30 days of termination</li>
              <li>We may delete your data after the 30-day period unless legally required to retain it</li>
              <li>All provisions of this Agreement which should survive termination shall survive</li>
            </ul>
          </section>

          <section id="governing-law" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              This Agreement shall be governed by and construed in accordance with the laws of the Netherlands, 
              without regard to its conflict of law provisions. Any dispute arising from or relating to this 
              Agreement shall be subject to the exclusive jurisdiction of the courts located in the Netherlands. 
              If any provision of this Agreement is found to be unenforceable or invalid, that provision shall 
              be limited or eliminated to the minimum extent necessary so that this Agreement shall otherwise 
              remain in full force and effect.
            </p>
          </section>

          <section id="contact" className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Agreement, please contact us:
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-foreground font-medium">FUIK COMPANY B.V.</p>
              <p className="text-muted-foreground">Email: legal@fuik.io</p>
              <p className="text-muted-foreground">Country: The Netherlands</p>
            </div>
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

export default EULA;
