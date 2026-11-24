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

Everything for the site lives in one dataset: `compose.yaml` (from this
repo), your `.env` (settings and secrets — only on the server, never in git)
and `data/` (the database and gift pictures).

Run these in **System → Shell** (as root). Change `POOL` to your pool's name.

```sh
POOL=tank
# 1. A dataset for the app (shows up under Datasets like any other)
midclt call pool.dataset.create '{"name": "'$POOL'/apps", "type": "FILESYSTEM"}' 2>/dev/null
midclt call pool.dataset.create '{"name": "'$POOL'/apps/wedding", "type": "FILESYSTEM"}'
cd /mnt/$POOL/apps/wedding

# 2. The compose file and a settings file to fill in
curl -fsSLO https://raw.githubusercontent.com/oliver-31415/wedding-app/main/deploy/compose.yaml
curl -fsSL https://raw.githubusercontent.com/oliver-31415/wedding-app/main/deploy/.env.example -o .env
chmod 600 .env
sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$(openssl rand -hex 32)/" .env

# 3. Fill in ALLOWED_SIGNUP_EMAILS, SMTP_PASS (Resend API key) and EMAIL_FROM
nano .env

# 4. Folder for the database and pictures, owned by the apps user
mkdir -p data && chown 568:568 data

# 5. Start it
docker compose up -d
docker compose ps
curl -s http://localhost:3080/api/health    # → {"ok":true}
```

Then:
- **Reverse proxy:** send `wedding.wright-guys.com` to
  `http://TRUENAS_IP:3080` with HTTPS. Keep the original `Host` header (the
  default in most proxies) and allow request bodies of at least 6 MB (gift
  pictures). Add a DNS record for `wedding` pointing at your proxy.
- **Accounts:** your brother opens https://wedding.wright-guys.com/signup,
  chooses "I've been told I can sign up", signs up with the email in
  `ALLOWED_SIGNUP_EMAILS`, clicks the confirmation link emailed to him, and
  sets up the wedding. In Settings → Hosts he invites his fiancée; her invite
  only works for her address, and she joins as co-host. Nobody else can sign up.

Containers started this way restart with the server (`restart: unless-stopped`).
To change a setting later: `nano .env`, then `docker compose up -d`.

### Email (SMTP, e.g. Resend)

The app sends email over SMTP:
- **account emails** — confirming a new account's email address, and
  password-reset links ("Forgot password?" on the sign-in page);
- co-host invites, guest invitations / reminders, and RSVP confirmations.

With [Resend](https://resend.com):
1. Add the domain `wright-guys.com` in Resend and create the DNS records it
   shows you (so emails aren't marked as spam).
2. Create an API key (Sending access is enough).
3. In `.env` set `SMTP_PASS` to the API key and `EMAIL_FROM` to an address
   on the verified domain, e.g. `Tom & Ana <wedding@wright-guys.com>`
   (`SMTP_HOST`, `SMTP_PORT` and `SMTP_USER` are already filled in for
   Resend; port 587 with `SMTP_SECURE=false` also works if 465 is blocked).
4. `docker compose up -d` to restart with email turned on.

**Once SMTP is set, new accounts must confirm their email** before they can
use the site (they get a link valid for 3 days; "Send the link again" is on
the waiting page). A co-host invite only works for the address it was sent
to. Without SMTP, nothing needs confirming — but nobody can reset a
password either, and guest emails can't be sent. Set it up before your
brother creates his account.

## One wedding at the root address

A server without `SUPERUSER_EMAILS` hosts one wedding and shows it at the root
of its domain: wedding.wright-guys.com, wedding.wright-guys.com/rsvp and so
on. The couple's admin is at /admin and signing in at /login. Until the
wedding has been created, the root address goes to the sign-in page.

## Hosting several weddings on one server (super users)

wedding.wright-guys.com hosts one wedding, so it doesn't use this. With super
users set, each wedding lives at /w/its-name instead of the root. If you run
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

**Update right now, by hand:**

```sh
cd /mnt/POOL/apps/wedding
docker compose pull wedding && docker compose up -d wedding
```

**Roll back** to an earlier version: every build is also tagged with its git
commit. Take a snapshot of the dataset first, then in `compose.yaml` change
the image to `ghcr.io/oliver-31415/wedding-app:<commit-sha>` (find the SHA in
GitHub's commit list) and `docker compose up -d`. Watchtower won't replace a
pinned tag; change it back to `:latest` to resume automatic updates.

**See logs:** `docker logs -f wedding`.

**Health check:** https://wedding.wright-guys.com/api/health returns
`{"ok":true}` when the app and database are working.

## Backups

Everything is in the dataset `POOL/apps/wedding` (`wedding.db*` files and
`uploads/`). Add a periodic snapshot task for it (Data Protection → Periodic
Snapshot Tasks, e.g. hourly, keep 2 weeks) and include it in any off-site
replication you have. To restore, roll back the snapshot with the app stopped.
