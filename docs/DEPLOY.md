# Deploying and updating

The site runs on TrueNAS as a Docker container built from this repository.

```
you / your brother ──push main──▶ GitHub Actions ──▶ ghcr.io/oliver-31415/wedding-app:latest
                                   (checks, then build)            │
                                                                   ▼
                              TrueNAS: watchtower checks every 5 min, pulls the new
                              image and restarts the "wedding" container
                                                                   │
                         reverse proxy (HTTPS) ──▶ wedding.wright-guys.com
```

Your data — the SQLite database and gift pictures — lives in a TrueNAS
dataset mounted at `/app/data`, so updates never touch it. Database changes
in new versions are applied automatically when the container starts.

## Who can deploy

- Only people with **write access** to the repository can push to `main`
  (you, and your brother once added as a collaborator). Anyone else can only
  open a pull request.
- Publishing a new image also requires the pusher to be listed in the
  repository variable **`DEPLOYERS`** (Settings → Secrets and variables →
  Actions → Variables), e.g. `oliver-31415,brothers-username`. Without it,
  only the repository owner deploys.
- Pull requests from outside contributors don't run any workflows until one
  of you approves them (Settings → Actions → General → "Require approval for
  all outside collaborators"), and they can never publish an image.
- Recommended: protect `main` (Settings → Rules → Rulesets) so it can't be
  force-pushed or deleted.

## First-time setup on TrueNAS

1. **Dataset.** Create `POOL/apps/wedding` (Datasets → Add Dataset, preset
   *Apps*). Its owner should be the `apps` user (uid 568).
2. **Secret.** Generate a session secret on any machine:
   `openssl rand -base64 48`.
3. **App.** Apps → Discover Apps → ⋮ → *Install via YAML*. Paste
   [`deploy/truenas-compose.yaml`](../deploy/truenas-compose.yaml) and fill in:
   - `POOL` in the volume path,
   - `SESSION_SECRET` (from step 2 — never change it later, it would sign everyone out),
   - `ALLOWED_SIGNUP_EMAILS` — the email of whoever sets the wedding up
     (on wedding.wright-guys.com: your brother). Leave `SUPERUSER_EMAILS` empty.
   - the SMTP settings for Resend (see *Email* below) — set these first, so
     accounts get confirmed and passwords can be reset.
   On TrueNAS 25.10+ the YAML must contain a `services:` key, which this file has.
4. **Reverse proxy.** Point `wedding.wright-guys.com` at
   `http://TRUENAS_IP:3080` in your existing proxy, with HTTPS. Make sure the
   proxy passes the original `Host` header (most do by default) and allows
   uploads of at least 6 MB (gift pictures). In DNS, add a record for
   `wedding` pointing at your proxy.
5. **The couple's accounts.** Your brother opens
   https://wedding.wright-guys.com/signup, chooses "I've been told I can sign
   up", creates his account with the email in `ALLOWED_SIGNUP_EMAILS`, clicks
   the confirmation link emailed to him, and sets up the wedding. Then, in Settings → Hosts, he invites his fiancée: her
   invite link lets her create an account and join the same wedding as a
   co-host, with the same access to everything (only the owner can manage
   hosts and change the web address). Nobody else can sign up.

### Email (SMTP, e.g. Resend)

The app sends email over SMTP:
- **account emails** — confirming a new account's email address, and
  password-reset links ("Forgot password?" on the sign-in page);
- co-host invites, guest invitations / reminders, and RSVP confirmations.

With [Resend](https://resend.com):
1. Add the domain `wright-guys.com` in Resend and create the DNS records it
   shows you (so emails aren't marked as spam).
2. Create an API key (Sending access is enough).
3. In the app's settings set `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`,
   `SMTP_USER=resend`, `SMTP_PASS=<the API key>` and `EMAIL_FROM` to an
   address on the verified domain, e.g. `Tom & Ana <wedding@wright-guys.com>`.
   (Port 587 with `SMTP_SECURE=false` also works if 465 is blocked.)
4. Save — the app restarts with email turned on.

**Once SMTP is set, new accounts must confirm their email** before they can
use the site (they get a link valid for 3 days; "Send the link again" is on
the waiting page). A co-host invite only works for the address it was sent
to. Without SMTP, nothing needs confirming — but nobody can reset a
password either, and guest emails can't be sent. Set it up before your
brother creates his account.

## Hosting several weddings on one server (super users)

wedding.wright-guys.com hosts one wedding, so it doesn't use this. If you run
another instance for several couples, put the people who run the server in
`SUPERUSER_EMAILS`. They are site admins. They can always create an
account, and they get **Site admin** in the sidebar (`/site-admin`), where
they can:
- create single-use invite links (optionally tied to an email address, which
  is emailed the link) for people to join and set up their own wedding,
- cancel unused invites,
- see every account and wedding on the server.

To help run an existing wedding, invite people as co-hosts instead
(Settings → Hosts in that wedding).

If neither `ALLOWED_SIGNUP_EMAILS` nor `SUPERUSER_EMAILS` is set, the first
person to sign up on a fresh server becomes its only open account — so always
set one of them before the site is reachable.

## Updating the server

**Normally: just push to `main`.** GitHub runs the checks, builds a new image,
and within about 5 minutes watchtower on TrueNAS pulls it and restarts the
container. Watch progress in the repository's *Actions* tab; a red ✗ means
nothing was deployed.

**Update right now, by hand** (System → Shell on TrueNAS):

```sh
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  nickfedor/watchtower --run-once --cleanup wedding
```

This pulls the latest image and recreates the `wedding` container with the
same settings — exactly what the automatic check does every 5 minutes.
(A plain `docker restart wedding` would keep running the old image.)

**Roll back** to an earlier version: every build is also tagged with its git
commit. Find the commit in GitHub (Actions → the run → the "image" job, or
the commit list), then in Apps → wedding → Edit change the image to
`ghcr.io/oliver-31415/wedding-app:<commit-sha>` and save. Watchtower won't
replace a pinned tag; switch back to `:latest` to resume automatic updates.
(Database migrations only add things, so an older version usually runs fine
on a newer database — but take a snapshot before rolling back.)

**See logs:** Apps → wedding → Logs, or `docker logs -f wedding`.

**Health check:** https://wedding.wright-guys.com/api/health returns
`{"ok":true}` when the app and database are working.

## Backups

Everything is in the dataset `POOL/apps/wedding` (`wedding.db*` files and
`uploads/`). Add a periodic snapshot task for it (Data Protection → Periodic
Snapshot Tasks, e.g. hourly, keep 2 weeks) and include it in any off-site
replication you have. To restore, roll back the snapshot with the app stopped.
