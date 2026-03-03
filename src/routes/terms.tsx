import { createFileRoute } from '@tanstack/react-router'

import StaticPageLayout from '@/components/StaticPageLayout'

export const Route = createFileRoute('/terms')({ component: Terms })

function Terms() {
  return (
    <StaticPageLayout title="Terms of Service">
      <p className="text-zinc-500 text-[13px]">
        Last updated: February 2026
      </p>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          1. Acceptance of Terms
        </h2>
        <p>
          By accessing or using Ayles Flow, you agree to be bound by these
          Terms of Service. If you do not agree to these terms, you may not use
          our services.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          2. Description of Service
        </h2>
        <p>
          Ayles Flow is an AI production studio that provides a visual canvas
          for creating workflows using multiple AI models. Our services include
          image, video, audio, music, and text generation, as well as an AI
          agent assistant, deep research capabilities, and PDF generation.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          3. Account Registration
        </h2>
        <p>
          You must create an account to use Ayles Flow. You are responsible for
          maintaining the confidentiality of your account credentials and for
          all activities that occur under your account. You must provide
          accurate and complete information when creating your account.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          4. Acceptable Use
        </h2>
        <p>You agree not to use Ayles Flow to:</p>
        <ul className="list-disc pl-6 space-y-1.5 mt-2">
          <li>Generate content that violates any applicable laws</li>
          <li>Create harmful, abusive, or misleading content</li>
          <li>Infringe on intellectual property rights of others</li>
          <li>Attempt to reverse engineer or exploit the platform</li>
          <li>Circumvent usage limits or billing mechanisms</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          5. Credits and Billing
        </h2>
        <p>
          Ayles Flow operates on a credit-based system. Free accounts receive a
          limited number of credits per month. Pro accounts receive additional
          credits for a monthly subscription fee. Credits are non-transferable
          and expire at the end of each billing cycle. All payments are
          processed through Stripe.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          6. Generated Content
        </h2>
        <p>
          You retain ownership of the prompts you provide. Generated content is
          subject to the terms of the underlying AI model providers. You are
          responsible for ensuring your use of generated content complies with
          applicable laws and the respective model provider terms.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          7. Limitation of Liability
        </h2>
        <p>
          Ayles Flow is provided &quot;as is&quot; without warranties of any
          kind. We are not liable for any indirect, incidental, or
          consequential damages arising from your use of the service. Our total
          liability is limited to the amount you have paid us in the twelve
          months preceding the claim.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          8. Termination
        </h2>
        <p>
          We may terminate or suspend your account at any time for violation of
          these terms. You may delete your account at any time. Upon
          termination, your right to use the service ceases immediately.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          9. Contact
        </h2>
        <p>
          For questions about these terms, contact us at{' '}
          <a
            href="mailto:legal@aylesflow.com"
            className="text-zinc-200 underline underline-offset-2 hover:text-white"
          >
            legal@aylesflow.com
          </a>
          .
        </p>
      </section>
    </StaticPageLayout>
  )
}
