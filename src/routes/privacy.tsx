import { createFileRoute } from '@tanstack/react-router'

import StaticPageLayout from '@/components/StaticPageLayout'

export const Route = createFileRoute('/privacy')({ component: Privacy })

function Privacy() {
  return (
    <StaticPageLayout title="Privacy Policy">
      <p className="text-zinc-500 text-[13px]">
        Last updated: February 2026
      </p>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          1. Information We Collect
        </h2>
        <p>
          When you create an account on Ayles Flow, we collect your name, email
          address, and authentication credentials through our identity provider
          (Clerk). When you use our services, we collect usage data such as
          projects created, models used, and generation history.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          2. How We Use Your Information
        </h2>
        <p>We use the information we collect to:</p>
        <ul className="list-disc pl-6 space-y-1.5 mt-2">
          <li>Provide, maintain, and improve our services</li>
          <li>Process your generations and manage your projects</li>
          <li>Send you technical notices and support messages</li>
          <li>Monitor usage patterns to improve the platform</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          3. Data Storage
        </h2>
        <p>
          Your project data, including canvas layouts, prompts, and generated
          content, is stored securely on our servers. Generated media files are
          stored using cloud storage providers. We retain your data for as long
          as your account is active or as needed to provide you services.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          4. Third-Party Services
        </h2>
        <p>
          We use third-party AI model providers (including Quasar, Google,
          Black Forest Labs, OpenAI, Stability AI, Kling, MiniMax, and
          ElevenLabs) to process your generation requests. Your prompts and
          input data may be sent to these providers to fulfill your requests.
          Each provider has their own privacy policy governing their use of
          this data.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          5. Data Security
        </h2>
        <p>
          We implement industry-standard security measures to protect your
          personal information. However, no method of transmission over the
          Internet or electronic storage is 100% secure. We cannot guarantee
          absolute security.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          6. Your Rights
        </h2>
        <p>You have the right to:</p>
        <ul className="list-disc pl-6 space-y-1.5 mt-2">
          <li>Access the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Export your data in a portable format</li>
          <li>Withdraw consent at any time</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          7. Contact
        </h2>
        <p>
          If you have questions about this privacy policy, please contact us at{' '}
          <a
            href="mailto:privacy@aylesflow.com"
            className="text-zinc-200 underline underline-offset-2 hover:text-white"
          >
            privacy@aylesflow.com
          </a>
          .
        </p>
      </section>
    </StaticPageLayout>
  )
}
