# Sarmad Ahmad — Portfolio

Static portfolio implementation based on the supplied Figma file, with a Vercel serverless backend for the hero-redesign lead form.

## Local preview

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

The static pages work with this preview. The submission and admin APIs require Vercel's local runtime or a deployment with the environment variables below.

## Structure

- `index.html` — semantic page structure and gallery content
- `styles.css` — responsive layout, motion, and lightbox styling
- `script.js` — scroll reveals, image loading transitions, keyboard/touch lightbox
- `assets/thumb` — optimized gallery images
- `assets/full` — higher-resolution lightbox images
- `redesign/` — the lead-magnet form page and private submissions viewer
- `api/` — Vercel functions for form submission and passcode-protected admin access
- `server/redesign.js` — shared server-side validation, Supabase, and signed-cookie helpers
- `server/redesign-email.js` — validated email notification payloads for new requests
- `supabase/redesign_submissions.sql` — one-time database setup

The site has no build step or runtime dependency. Vercel serves the static files and runs the API files as Node.js serverless functions.

## Redesign submissions setup

1. Create or choose a Supabase project and run `supabase/redesign_submissions.sql` once in its SQL Editor.
2. Add these environment variables to the Vercel project (see `.env.example`):
   - `SUPABASE_URL` — the project URL from Supabase Connect.
   - `SUPABASE_SECRET_KEY` — a new `sb_secret_...` server key. A legacy service-role key also works via `SUPABASE_SERVICE_ROLE_KEY`. Never expose either one in browser code.
   - `ADMIN_PASSCODE` — the private passcode for `/redesign/submissions`.
   - `ADMIN_SESSION_SECRET` — at least 32 random characters used to sign the 30-day admin cookie (for example, generate one with `openssl rand -base64 32`).
3. Deploy, submit one test response at `/redesign`, and confirm it appears at `/redesign/submissions`.

The table has RLS enabled, grants no access to anonymous or authenticated browser roles, and is only read/written by the server-side secret role.

Every valid submission is saved and then emailed to **smmd999a@gmail.com** through FormSubmit. This form has been activated for `https://www.smmd.me/redesign`; it needs no Resend account, API key, or additional environment variables. The email includes all submitted details, a link to the private submissions viewer, and the submitter's email as Reply-To.

The API saves the submission and returns its validated notification payload. The browser sends it using FormSubmit’s supported AJAX flow, waits for email acceptance before showing success, and retries failed sends up to three times. Sending from Vercel’s datacenter is blocked by FormSubmit. If notification fails, the submission stays saved; retrying the unchanged form retries only its email. Provider acceptance does not guarantee inbox delivery; verify with a test email after changing the recipient or form URL. No browser secrets are used.
