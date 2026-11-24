# Wedding

A small, self-hosted wedding website and planner: guest list, RSVPs (with
per-event invitations, plus-ones and meal questions), a gift list with
pictures and cash funds, guest emails, and five site styles.

Live at **https://wedding.wright-guys.com**. Every push to `main` by an
allowed deployer is built and rolled out automatically (see
[docs/DEPLOY.md](docs/DEPLOY.md)).

## Working on it

Needs Node 22 and pnpm (`corepack enable`).

```sh
pnpm install
pnpm db:migrate        # creates data/wedding.db
pnpm db:seed           # demo wedding: demo@example.com / wedding-demo, site /w/alex-and-sam
pnpm dev               # http://localhost:3000
```

Before pushing:

```sh
pnpm typecheck && pnpm lint && pnpm test
```

The same checks run on GitHub for every push and pull request; `main` only
deploys when they pass.

**Read [docs/CONVENTIONS.md](docs/CONVENTIONS.md) before changing code** — it
explains the product rules (nothing appears on the site unless the couple adds
it), where the RSVP rules and statistics live, the UI kit, and the status
words every screen uses.

### Changing the database

Edit `src/db/schema.ts`, then `pnpm db:generate` to create a migration in
`drizzle/` and `pnpm db:migrate` to apply it locally. Commit the migration —
the server applies new migrations automatically when it starts.

### Branches

Small changes can go straight to `main`. For anything bigger, push a branch
and open a pull request so the checks run before it reaches the live site.
