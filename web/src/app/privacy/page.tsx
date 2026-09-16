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
      "When you upload a resume, the file is sent to the server to pull out its text; the file itself is not kept. The text is sent to an AI model to list your skills and experience.",
      "The resume text, that list, your details (program, term, GPA if you give it) and the skills you add are saved on the server under your email, and in your browser. You can keep a few resumes; one of them is in use at a time. The server keeps them so every open posting can be checked against your resume while you're away, and so your resume follows you to another browser. The site owner runs the server and can see what is stored on it.",
      "To check a posting, your resume — without your email, phone number or profile links — is sent to an AI model together with the posting's lines. The result, which lines your resume meets and where, is saved on the server under your email.",
      "Match advice and cover letters send your profile or resume text with each request; their answers are kept only in your browser. Saved jobs also live only in your browser.",
      "Remove a resume in the app and it is deleted from the server, with every check made against it. If the owner removes your account, your resume goes too.",
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
      "Google confirms who you are when you sign in. Cloudflare carries traffic to the site. An AI provider reads resume text, profiles and postings to produce skills, checks and advice. Matching postings to a skill you add also uses a model running on the site's own server, which sends nothing elsewhere. None of them receive anything from this site beyond what is described above.",
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
