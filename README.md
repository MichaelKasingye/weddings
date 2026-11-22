# Aaron & Josephine: Wedding Invitations

A Next.js (TypeScript) app with MongoDB.

- **Guests** each get a personal link, e.g. `/i/mr-mrs-john-doe-k3x9pqr`. It opens the animated invitation poster with their name on the guest bar and "Invite for (n)". Guests don't log in.
- **Admins** log in to a dashboard. They upload the guest list, see totals, copy each guest's link, and send the invitations on WhatsApp or by SMS.

Made-up or mistyped links show **"Invitation not found"** with the RSVP contacts. The bare address (`/`) shows **"This is a private invitation"**.

## Run it locally

Needs Node 20+ and MongoDB.

```bash
npm install
cp .env.example .env.local     # then edit: MONGODB_URI, APP_URL, SUPER_ADMIN_USERNAME
npm run dev                    # http://localhost:3000
```

The first time, open **http://localhost:3000/setup** and choose the super admin's password. The username comes from `SUPER_ADMIN_USERNAME`. After that, `/setup` is closed and you log in at `/login`.

## Roles

| | Super admin | Admin |
|---|---|---|
| See the dashboard, guest list, views and PDF downloads | ✅ | ✅ |
| Send on WhatsApp / SMS, copy links, download CSV | ✅ | ✅ |
| Change own username and password (My account) | ✅ | ✅ |
| Upload the list; add, edit, delete guests | ✅ | — |
| Invite admins, reset their passwords, remove them (Team) | ✅ | — |
| Make an admin a super admin, or a super admin a regular admin (Team) | ✅ | — |
| RSVP contacts, message wording, SMS on/off (Settings) | ✅ | — |

**Super admins:** there can be up to **3**. On the Team page, a super admin presses *Make super admin* next to an admin, or *Make regular admin* to undo it (also for themselves). There is always at least one super admin. A super admin is removed by making them a regular admin first. Every change goes into the activity log.

**Adding an admin:** Team → *Create invite link*. Send the link any way you like (WhatsApp, SMS, email). It works **once** and expires after **24 hours**. The person opens it and chooses a username and password.

**Forgotten password (admin):** Team → *Reset password* gives a new one-time 24-hour link for that admin. There's no email reset.

**Forgotten password (super admin):** another super admin can make a reset link for them on the Team page. Otherwise there are two ways:
- **On the website:** on the login page, click *Reset it with the setup code* (`/recover`). If there are several super admins, choose which one. Enter the `SETUP_CODE` from the environment variables and a new password. After 5 wrong codes, that address has to wait an hour.
- **From a computer with the project:** run `npm run reset-password` (or `npm run reset-password -- <username>` for any admin). It asks for the new password twice. It uses `MONGODB_URI` from `.env.local`, so for the live site, put the Vercel value in `.env.local` or in front of the command (`MONGODB_URI="…" npm run reset-password`). This works even when the website is down.

Both log that admin out on every device and record the reset in the activity log.

## The guest list

Upload an Excel (`.xlsx`) or CSV file (Upload list), or paste the list.

| Name | Phone | Seats |
|---|---|---|
| Mr. & Mrs. John Doe | 0772 123456 | 2 |
| Dr. Sarah Kato | +256 701 234567 | |

- **Name** is shown exactly as written on the invitation. A separate *Title* column (Mr./Mrs./Dr.) is joined onto the name.
- **Phone** can be written any way. Numbers without a country code are read as Ugandan.
- **Seats** is optional. If it's empty, it's 2 when the name has "Mr. & Mrs.", otherwise 1.

Before anything is saved, you see a preview with bad numbers and duplicates marked. Uploading again only adds new guests. Renaming a guest keeps their link working: an old link moves to the new name.

## Sending

- **WhatsApp:** each guest's *WhatsApp* button opens WhatsApp with their number and the message ready, and the admin presses send. *Send on WhatsApp* for ticked guests goes through them one by one. The guest is then marked "sent".
- **SMS (Africa's Talking):**
  1. Set `AT_USERNAME`, `AT_API_KEY` and, once approved, `AT_SENDER_ID`.
  2. Switch SMS on in Settings. Tick guests and press *Send SMS*.
  3. For delivery reports, set the callback in Africa's Talking to `https://<site>/api/sms?key=<AT_CALLBACK_KEY>`.

  With `AT_USERNAME=sandbox`, messages go to their simulator instead of real phones.
- **Viewed:** counted each time the invite loads in a real browser. WhatsApp's link-preview robot doesn't count, and neither do logged-in admins previewing an invite.

## Views and PDF downloads

- **Download as PDF:** the round download button at the bottom right of the invitation (above the music button, outside the poster). The guest gets a one-page PDF of the finished poster with their name and seats, to keep on their phone.
- **What admins see:** Overview has *Viewed*, *Sent, not viewed*, *Downloaded PDF* and *Views in total*, plus *Recent guest activity*. In the guest list, each guest shows "Viewed 3× · last time" and "PDF 1× · last time", and there are *Viewed* and *Downloaded PDF* filters. The CSV has the counts. The eye button (or a chip) opens the guest's **history**: every view and download with the time and the kind of device (e.g. "iPhone", "Android phone").
- Downloads by a logged-in admin don't count.
- Everything on a personal link counts for that guest, including anyone they forwarded it to.

**How the PDF is made:** `src/og/poster-pdf.jpg` is a photo of the real poster with the guest's name and seats and the RSVP names and numbers left blank. For each download, `src/lib/invite-pdf.tsx` draws those back in, with the poster's fonts and layout, so a change to the RSVP contacts in Settings shows in the PDF at once. **If the poster's artwork or wording changes, take the photo again:**

```bash
npm run dev                                              # in another terminal
CHROME=/usr/bin/google-chrome npm run pdf-snapshot -- http://localhost:3000/i/<any-guest-link>
```

(It needs Playwright or Chrome. That visit isn't counted as a view.)

The message wording (with `{name}` and `{link}`) is edited in Settings.

## Deploy to Vercel

1. Create a free **MongoDB Atlas** cluster. Under Network Access allow `0.0.0.0/0` (Vercel has no fixed IP). Copy the connection string and add a database name, e.g. `…mongodb.net/wedding_invites`.
2. Import the GitHub repo into Vercel. The framework is detected as Next.js.
3. Add environment variables:
   - `MONGODB_URI`
   - `APP_URL` (e.g. `https://aaronandjosephine.vercel.app`)
   - `SUPER_ADMIN_USERNAME`
   - `SETUP_CODE` (any secret; required on Vercel so nobody else can claim `/setup`)
   - the `AT_*` values for SMS
4. Deploy, then open `/setup` and enter the setup code and your password.

## Health check

`GET /api/health` goes through the API to MongoDB and back. It sends a `ping` and writes and reads a heartbeat document (`health` collection). It returns **200** with the database's answer and timings, or **503** if the database didn't answer within 10 seconds:

```json
{"status":"ok","totalMs":784,"database":{"name":"wedding_invites","ping":{"ok":1,"ms":362},"heartbeat":{"count":2,"lastAt":"…","firstAt":"…","ms":420}}}
```

When it fails, `database.error` says why: `not_configured` (no `MONGODB_URI`), `bad_uri`, `auth_failed` (wrong username/password), `ip_blocked` (Atlas Network Access), `host_not_found`, `refused` (database not running) or `unreachable` (down or paused). Each comes with a plain explanation and how to fix it.

If a page can't reach the database, it shows that reason instead of crashing. The dashboard and login pages show the full explanation and how to fix it. Guests see a short "can't open the invitation right now" message with a *Try again* button and the RSVP contacts. The error pages are `src/app/(admin)/error.tsx`, `src/app/(invite)/error.tsx` and `src/app/global-error.tsx`, and the explanations are in `src/lib/db-errors.ts`. Requests to the database give up after 7 seconds instead of the driver's 30.

Vercel Cron calls it every day at 06:00 UTC (`vercel.json`), so the Atlas cluster always has activity and isn't paused. To check more often and get an alert when it's down, point a free uptime monitor (e.g. UptimeRobot) at `https://<site>/api/health`.

## Changing the invitation

- **Wording, date, venues, families:** `src/lib/wedding.ts`.
- **RSVP contacts:** Dashboard → Settings (stored in MongoDB, shown immediately).
- **Positions and sizes of the text:** `src/components/poster/Poster.tsx`. Each line has `--x / --y / --fs / --lh / --sx` in poster pixels (the poster is a 1065 × 1598 grid).
- **Styles:** `src/styles/poster.css` (invitation) and `src/styles/admin.css` (dashboard).
- **Artwork:** `public/assets/art/*.webp`, rebuilt by the scripts in `tools/poster-build/` (see its README).
- **Link preview:** each guest's preview picture is drawn by `src/app/(invite)/i/[slug]/opengraph-image.tsx` from `src/og/share-card.jpg` plus their name. If the poster changes, refresh that card. Its left half still shows an older version of the poster.

Fireworks and confetti are `public/js/fireworks.js` and `public/js/confetti.js` (settings in `src/lib/wedding.ts`).

## React Query (dashboard data)

The dashboard's guest list uses [TanStack React Query](https://tanstack.com/query):

- The Guests page is rendered on the server, and that list is handed to React Query (`HydrationBoundary`), so the first load doesn't fetch it a second time.
- After that, the list refreshes itself from `GET /api/admin/guests` every minute and whenever you come back to the tab (e.g. from WhatsApp). New views, PDF downloads and SMS delivery reports appear without reloading.
- *WhatsApp sent*, *undo* and *Delete* change the list at once (optimistic updates). If the server refuses, the change is undone and the error is shown.
- In `npm run dev`, a React Query Devtools button (bottom left) shows what's cached.

Files: `src/lib/query-client.ts` (defaults: data is fresh for 30 s, one retry), `src/lib/queries.ts` (the hooks), `src/lib/query-keys.ts`, `src/components/QueryProvider.tsx`.

## Files

```
src/app/(invite)/          guest side: / (private notice), /i/[slug] (the invitation + its preview image)
src/app/(admin)/           /login, /setup, /join/[token], /dashboard/*
src/app/(admin)/dashboard/actions.ts   every dashboard change (each checks the role on the server)
src/app/api/open           records "viewed";  /i/<link>/pdf: the PDF download;  src/app/api/sms: SMS delivery reports;  src/app/api/health: database health check
src/components/poster/     the poster (markup + browser behaviour)
src/components/admin/      dashboard pieces (guest list, uploader, team…)
src/lib/                   database, login/sessions, guests, phone numbers, SMS, wedding details
public/                    artwork, music, icons, fireworks/confetti scripts
tools/poster-build/        scripts that built the artwork
```

**Security:**
- Admin passwords are stored as scrypt hashes, and sessions are httpOnly cookies.
- Join and reset links are stored only as hashes.
- Guest link codes are 7 random characters (about 27 billion possibilities).
- After about 30 wrong invitation links in 15 minutes, a visitor is paused. The same goes for repeated wrong passwords.

Credits: fonts Google Fonts (Poppins, Playball, Great Vibes, Cardo, Libre Caslon Text, Montserrat, Cormorant Garamond) · icons Lucide (ISC) · confetti canvas-confetti (ISC).
