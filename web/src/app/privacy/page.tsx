import type { Metadata } from "next";

// Linked from the Google sign-in consent screen, so it is served without
// signing in (pages are open; src/proxy.ts guards the API). Keep it true to
// what the code does — every claim below is checked against the routes, the
// app_users table and the hooks.

export const metadata: Metadata = {
  title: "Privacy · betterUWWorks",
  description: "What betterUWWorks does with your sign-in and your resume.",
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "Signing in",
    body: [
      "betterUWWorks is a private site for a small group of University of Waterloo students. You sign in with Google, and a new account sees nothing until the site owner approves it.",
      "From Google the site receives your name, email address and the link to your profile picture. It keeps those, with when you first and last signed in and whether you have been approved, so the owner can decide who may see the postings. It also counts how many AI requests you make each day; that count is kept in memory only and resets daily.",
    ],
  },
  {
    heading: "Your resume",
    body: [
      "When you upload a resume, the file is sent to the server to pull out its text and is not kept. The text is sent to an AI model to list your skills and experience, and that result is saved in your own browser, not on the server.",
      "Match advice and cover letters work the same way: your saved profile or resume text is sent with each request, read by an AI model, and the answer is kept in your browser. Saved jobs also live only in your browser.",
      "Remove your resume in the app, or clear this site's data in your browser, and it is gone.",
    ],
  },
  {
    heading: "Job postings",
    body: [
      "The postings come from WaterlooWorks, gathered by the site owner, and are visible only to people the owner has approved.",
    ],
  },
  {
    heading: "Services involved",
    body: [
      "Google confirms who you are when you sign in. Cloudflare carries traffic to the site. An AI provider reads resume text and profiles to produce skills and advice. None of them receive anything from this site beyond what is described above.",
    ],
  },
  {
    heading: "Questions",
    body: [
      "Ask the person who invited you. They run the site, can remove your access at any time, and will delete your sign-in record if you ask.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="flex-1 bg-canvas">
      <article className="max-w-[680px] mx-auto px-5 py-14 sm:py-20 space-y-10">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-steel">betterUWWorks</p>
          <h1 className="text-[28px] leading-tight font-semibold text-ink">Privacy</h1>
          <p className="text-[13px] text-steel">Last updated September 14, 2026</p>
        </header>

        {SECTIONS.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="text-[16px] font-semibold text-ink">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="text-[14.5px] leading-7 text-charcoal">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </main>
  );
}
