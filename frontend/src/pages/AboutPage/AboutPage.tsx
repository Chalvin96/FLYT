import { Link } from '@tanstack/react-router';

export function AboutPage() {
  return (
    <div className="bg-background text-foreground">
      <header className="bg-background px-4 py-5 sm:px-6">
        <div className="container-max mx-auto flex items-center justify-between">
          <Link className="flex items-center gap-2 text-foreground" to="/">
            <span className="size-3 rounded-full bg-primary-70" />
            <span className="font-display type-title font-semibold">Flyt</span>
          </Link>
          <Link
            className="type-caption text-secondary-70 hover:text-foreground"
            to="/"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="shell-px py-16 sm:py-20">
        <div className="container-max mx-auto max-w-2xl">
          {/* About */}
          <section id="about">
            <p className="type-label text-primary-70">About</p>
            <h1 className="mt-3 font-display type-display-lg font-semibold text-secondary-100">
              Why Flyt exists
            </h1>
            <div className="mt-8 space-y-5 type-body leading-8 text-secondary-70">
              <p>
                Flyt started as a personal frustration. I was learning Norwegian
                using Anki for vocabulary and a separate app for lessons — but
                the two never talked to each other. Anki didn&rsquo;t know what
                I was reading. The lesson app didn&rsquo;t know what I was
                reviewing. I was learning words in isolation, not the language.
              </p>
              <p>
                The problem isn&rsquo;t the tools individually — it&rsquo;s that
                they&rsquo;re disconnected. When you read a new word and have to
                manually copy it into a flashcard app, most people just
                don&rsquo;t. That word disappears.
              </p>
              <p>
                Flyt is one place to go from beginner to intermediate Norwegian.
                Lessons, reading, and spaced-repetition review are wired
                together — so a word you encounter in a story automatically
                shows up in review, and the grammar you study becomes cards
                without any extra work.
              </p>
              <p>It&rsquo;s a solo project, built because I needed it.</p>
            </div>
          </section>

          <hr className="my-14 border-border" />

          {/* Privacy */}
          <section id="privacy">
            <p className="type-label text-primary-70">Privacy</p>
            <h2 className="mt-3 font-display type-display font-semibold text-secondary-100">
              Privacy policy
            </h2>
            <div className="mt-8 space-y-5 type-body leading-8 text-secondary-70">
              <p>
                Flyt collects only what is necessary to run the app. Your
                account is created with Google Sign-In. Flyt receives your name,
                email address, and profile picture information from Google and
                stores them to identify and display your account.
              </p>
              <p>
                Flyt stores learning data such as your lesson progress,
                vocabulary, review history, and reading progress to provide
                lessons, spaced-repetition review, reading, and story
                generation.
              </p>
              <p>
                When you generate a story, Flyt sends selected vocabulary from
                your learning activity, along with your chosen story direction,
                length, and topic, to the configured external AI provider so it
                can write the story. When you use the chatbot, Flyt sends your
                message, recent conversation history, and the current page
                context to the provider you choose so it can generate a reply.
                These providers process the information to provide the requested
                feature.
              </p>
              <p>
                Flyt uses Sentry for error monitoring. Sentry may receive
                technical error information such as your browser and device
                details when an error occurs. See{' '}
                <a
                  className="text-primary-70 underline underline-offset-2 hover:text-primary-60"
                  href="https://sentry.io/privacy/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Sentry&rsquo;s privacy policy
                </a>{' '}
                for details.
              </p>
              <p>
                Flyt uses strictly necessary cookies for authentication. No
                tracking or advertising cookies are used.
              </p>
              <p>
                Flyt does not sell personal data, run ads, use tracking pixels,
                or use marketing analytics.
              </p>
              <p>
                You can review your account and learning data in Flyt, update
                your display name, and delete your account from Account. For
                access, correction, deletion, or other data requests, email{' '}
                <a
                  className="text-primary-70 underline underline-offset-2 hover:text-primary-60"
                  href="mailto:hallo.flyt@gmail.com"
                >
                  hallo.flyt@gmail.com
                </a>
                .
              </p>
            </div>
          </section>

          <hr className="my-14 border-border" />

          {/* Contact */}
          <section id="contact">
            <p className="type-label text-primary-70">Contact</p>
            <h2 className="mt-3 font-display type-display font-semibold text-secondary-100">
              Get in touch
            </h2>
            <div className="mt-8 space-y-5 type-body leading-8 text-secondary-70">
              <p>
                For questions, feedback, or data requests, email{' '}
                <a
                  className="text-primary-70 underline underline-offset-2 hover:text-primary-60"
                  href="mailto:hallo.flyt@gmail.com"
                >
                  hallo.flyt@gmail.com
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="bg-secondary-100 text-secondary-20">
        <div className="shell-px py-10">
          <div className="container-max mx-auto flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Link className="flex items-center gap-2 text-white-100" to="/">
              <span className="size-3 rounded-full bg-primary-70" />
              <span className="font-display type-title font-semibold">
                Flyt
              </span>
            </Link>
            <p className="type-caption text-secondary-40">
              © {new Date().getFullYear()} Flyt. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

AboutPage.displayName = 'AboutPage';
