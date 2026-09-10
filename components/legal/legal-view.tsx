"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface LegalViewProps {
  initialTab?: "privacy" | "terms";
}

export function LegalView({ initialTab = "privacy" }: LegalViewProps) {
  const [activeTab, setActiveTab] = useState<"privacy" | "terms">(initialTab);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Top Navigation */}
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Raymarkable</span>
          </Link>

          {/* Quick Tab Switcher */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("privacy")}
              className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === "privacy"
                  ? "text-black dark:text-white underline underline-offset-4 decoration-2"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Privacy Policy
            </button>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <button
              type="button"
              onClick={() => setActiveTab("terms")}
              className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === "terms"
                  ? "text-black dark:text-white underline underline-offset-4 decoration-2"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Terms of Service
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12">
        {activeTab === "privacy" ? (
          /* Privacy Policy Section */
          <article className="space-y-10">
            {/* Title & Date */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-black dark:text-white">
                Privacy Policy
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Last updated: March 2026
              </p>
            </div>

            {/* TL;DR Summary */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Summary in Plain English
              </h3>
              <ul className="list-disc list-inside space-y-2 text-sm text-zinc-700 dark:text-zinc-300 pl-1">
                <li>
                  We only collect your Google profile (name, email, avatar) to authenticate you and save your habits.
                </li>
                <li>
                  We <strong>never sell, rent, or monetize</strong> your personal data or habit history with third parties or advertisers.
                </li>
                <li>
                  You retain 100% ownership. You can permanently delete your entire account and all records anytime from Settings.
                </li>
              </ul>
            </div>

            <hr className="border-zinc-200 dark:border-zinc-800" />

            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-black dark:text-white">
                1. Information We Collect
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                When you use Raymarkable, we collect only the minimal data necessary to provide habit tracking and accountability features:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 pl-2">
                <li>
                  <strong className="text-black dark:text-white">Google Account Data:</strong> Your name, email address, and profile photo provided via Google OAuth to create and identify your account.
                </li>
                <li>
                  <strong className="text-black dark:text-white">Habit & Progress Data:</strong> Habit titles, target values, daily completion logs, dynamic streaks, and category presets.
                </li>
                <li>
                  <strong className="text-black dark:text-white">Accountability Pod Data:</strong> Team memberships, shared streaks, and teammate nudges you send or receive.
                </li>
                <li>
                  <strong className="text-black dark:text-white">Push Notification Tokens:</strong> Encrypted browser endpoint tokens (VAPID) if you explicitly opt-in to device reminders.
                </li>
              </ul>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-black dark:text-white">
                2. How We Use Your Information
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Your data is strictly utilized to operate the Raymarkable service:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-zinc-700 dark:text-zinc-300 pl-2">
                <li>Authenticating you securely and maintaining your login session.</li>
                <li>Computing accurate habit streaks and generating visual progress charts.</li>
                <li>Broadcasting real-time completion events and nudges within your accountability pods.</li>
                <li>Delivering requested push notifications to your devices.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-black dark:text-white">
                3. Third-Party Infrastructure
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                We do not operate third-party tracking or advertising SDKs. We rely only on standard cloud infrastructure providers:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-zinc-700 dark:text-zinc-300 pl-2">
                <li><strong className="text-black dark:text-white">Supabase:</strong> Encrypted PostgreSQL database, authentication, and avatar storage.</li>
                <li><strong className="text-black dark:text-white">Vercel:</strong> Web application hosting and serverless execution.</li>
                <li><strong className="text-black dark:text-white">Google Cloud:</strong> Secure OAuth authentication service.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-black dark:text-white">
                4. Data Retention & Permanent Account Deletion
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                We believe in full user data autonomy. You can permanently delete your account at any time by going to <strong className="text-black dark:text-white">Settings &gt; Delete Account</strong>.
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Triggering deletion immediately and irrevocably cascades across our database, permanently purging your user record, habit logs, team memberships, and notification history.
              </p>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-black dark:text-white">
                5. Contact & Inquiries
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                If you have questions about this Privacy Policy or your data, you can contact the developer at{" "}
                <a
                  href="mailto:paulbenedictmedina@gmail.com"
                  className="text-black dark:text-white underline underline-offset-2 font-medium"
                >
                  paulbenedictmedina@gmail.com
                </a>
              </p>
            </section>
          </article>
        ) : (
          /* Terms of Service Section */
          <article className="space-y-10">
            {/* Title & Date */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-black dark:text-white">
                Terms of Service
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Last updated: March 2026
              </p>
            </div>

            <hr className="border-zinc-200 dark:border-zinc-800" />

            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-black dark:text-white">
                1. Acceptance of Terms
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                By accessing or using Raymarkable (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may discontinue use and delete your account.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-black dark:text-white">
                2. Nature of the Service
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Raymarkable is a personal habit mastery and team accountability application designed to assist users in building healthy habits and tracking personal goals. The Service is provided for personal, non-commercial self-improvement purposes.
              </p>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-black dark:text-white">
                3. User Conduct & Pod Etiquette
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Users are expected to engage respectfully within accountability pods:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-zinc-700 dark:text-zinc-300 pl-2">
                <li>You agree not to abuse or spam teammate nudges or notification systems.</li>
                <li>You agree not to use offensive, abusive, or unlawful language in pod names, habit titles, or profile names.</li>
                <li>You may not attempt to reverse engineer, disrupt, or exploit the API infrastructure.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-black dark:text-white">
                4. Disclaimer & Limitation of Liability
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express or implied. Raymarkable does not guarantee uninterrupted uptime, although reasonable efforts are maintained to ensure reliability.
              </p>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-black dark:text-white">
                5. Termination
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                You may terminate your agreement with Raymarkable at any time simply by deleting your account within the application settings. We reserve the right to suspend or terminate accounts that violate system integrity or security.
              </p>
            </section>
          </article>
        )}
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <p>© {new Date().getFullYear()} Raymarkable. Build better habits.</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("privacy")}
              className="hover:text-black dark:hover:text-white cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setActiveTab("terms")}
              className="hover:text-black dark:hover:text-white cursor-pointer"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
