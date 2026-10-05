# Putting HEARTS on the internet

This is for the person who will create the hosting account and sign in. You do not need to change the program. You will copy a few values into a website, run two commands, and then sign in.

The app and its database live on [Railway](https://railway.com). The files people upload (a picture, a worksheet) go into a bucket Railway provides, so they are still there after the next update. The database is Postgres. Your own computer can keep using the SQLite file; that choice is automatic.

Do this on a computer where you can open a browser. Set aside a quiet half hour. The talk library takes several minutes to load at the end, and you should leave that window open until it finishes.

## What you will have at the end

- A website address you can send to people.
- One master account, which is yours. You choose the email and the password. They are not written in this repository.
- The starter talks loaded, as drafts. Learners do not see a draft until you approve it, or until you turn on “Show unchecked talks” on the master desk.
- A health page at `/api/health`. If that page says `"ok": true`, the app can see the database.

## Why Railway, and why not Vercel

Railway runs the app as one program that stays on. That is how this app is built.

Vercel runs a fresh copy for each visit, and throws it away afterwards. That does not suit this app:

- Failed join attempts are counted in the memory of the one running program. On Vercel that count would reset every visit, so it would not slow someone guessing codes.
- The app keeps a steady connection to the database. Vercel’s copies open new connections until the database refuses more.
- Creating your account, and loading the talks, are commands you type once. Vercel does not give you a shell on the running app to type them.
- Fetching a transcript from YouTube can take longer than Vercel allows a single visit to run.
- The program is large. It is a poor fit for the size limit on those short-lived copies.

A bucket would keep the uploaded files, and Postgres would keep the data, but neither of those fixes the list above. Render and Fly, at the bottom of this page, run one program the same way Railway does. Vercel does not.

## 1. Create the Railway account

1. Open [https://railway.com](https://railway.com).
2. Choose **Login**, then **Login with GitHub**.
3. Approve access to the GitHub account that owns this repository. If the repository is private, that is fine. Railway only needs to read it.

You will need a card on the account. The smallest sizes are enough to start. Give the app **at least 1 GB of memory**. Loading the talks uses more than the smallest size, and the app can be stopped mid-load if the memory is too small.

## 2. Create the project and point it at this repository

1. Click **New Project**.
2. Choose **Deploy from GitHub repo**.
3. Pick this repository. If it is not in the list, choose the option to configure GitHub access and tick the repository, then come back.
4. Railway starts a service for the app. Open that service, then **Settings**.
5. Set **Root Directory** to `hearts-prototype`. If this is wrong, Railway will not find the Dockerfile and the deploy will fail.
6. Set the **branch** to the branch you were given. Deploy that branch. After the hosting work is merged, you can switch this setting to the project branch and Railway will redeploy.
7. Leave the start command empty. The Dockerfile already knows how to start.

The first deploy may fail on purpose. The app refuses to start until the variables in the next steps are filled in. The log will say `HEARTS cannot start` and list what is missing, in plain sentences. That is the check working.

## 3. Add the database

1. On the project canvas, click **New**, then **Database**, then **PostgreSQL**.
2. Wait until it is online. Railway names it `Postgres` unless you rename it.
3. Do not turn on public networking. The app talks to the database inside Railway’s private network. A public address is only for a backup, and you turn it off again afterwards.

## 4. Add the bucket

Uploaded files must not live on the app’s disk. Every deploy would wipe them.

1. On the project canvas, click **New**, then **Bucket**.
2. Wait until it exists. The name in the canvas is what you will use in the references below. This guide calls it `Bucket`. If you named it something else, use that name instead.

The bucket is private. The app reads and writes it with the keys. Visitors do not get a public link to the bucket.

## 5. Give the app a web address

1. Open the app service, then **Settings**, then **Networking**.
2. Click **Generate Domain**. Railway gives you an address ending in `.up.railway.app`.
3. Copy it. You will paste it, with `https://` in front, as `SERVER_URL`. No slash at the end.

Example: `https://hearts-production.up.railway.app`

## 6. Set the variables

Open the app service, then **Variables**, then **New Variable**. Add these. For the database and the bucket, use **Add Reference** (or paste the `${{ }}` line). Do not copy the password out by hand.

| Variable | What to put | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Use the private address, the one Railway fills in. If your database service is not named Postgres, pick its name from the reference list. |
| `PAYLOAD_SECRET` | A long random string | At least 32 characters. A password manager can generate one. It is not a password you type every day. Do not use `hearts-master` or any password from the README. |
| `SERVER_URL` | `https://` plus the domain from step 5 | No slash at the end. |
| `HEARTS_TRUSTED_PROXY_HOPS` | `1` | Railway’s proxy adds the visitor’s real address at the end of a list. The app trusts only that last address. A visitor cannot pick their own address by sending a fake `X-Forwarded-For`. |
| `BUCKET` | `${{Bucket.BUCKET}}` | |
| `ACCESS_KEY_ID` | `${{Bucket.ACCESS_KEY_ID}}` | |
| `SECRET_ACCESS_KEY` | `${{Bucket.SECRET_ACCESS_KEY}}` | |
| `REGION` | `${{Bucket.REGION}}` | |
| `ENDPOINT` | `${{Bucket.ENDPOINT}}` | |
| `BOOTSTRAP_ADMIN_EMAIL` | Your own email | This becomes the master account. Do not use an `@hearts.test` address. |
| `BOOTSTRAP_ADMIN_PASSWORD` | A password you choose | At least 12 characters. Not `hearts-master`, `portal-admin`, `portal-teacher`, or `portal-learner`. |
| `BOOTSTRAP_ADMIN_NAME` | Your name | Optional. If you leave it out, the account is called Master. |

Optional, only if Cloudflare sits in front of the site. Do not change DNS or Turnstile from this repository. See **Cloudflare in front of HEARTS** in the README for the dashboard steps.

| Variable | What to put | Notes |
| --- | --- | --- |
| `TURNSTILE_SITE_KEY` | The Turnstile site key | Both keys must be set. Missing keys leave join, sign-in and password reset unchanged. |
| `TURNSTILE_SECRET_KEY` | The Turnstile secret key | Keep this on the host only. |
| `CF_CONNECTING_IP` | `1` | Trust Cloudflare’s visitor address header. |

`NODE_ENV` is already `production` inside the image. You do not need to set it.

Click **Deploy** (or wait for the automatic redeploy) after the variables are saved.

## 7. Check that it started

1. Open the app service and read the **Deployments** log.
2. If a line starts with `HEARTS cannot start`, the lines under it say which variable to fix. Fix it and let it deploy again. Nothing has been deleted.
3. When the deploy is healthy, open `https://your-domain/api/health` in a browser.

You want:

```json
{"ok":true,"database":"postgres","storage":"s3"}
```

`database` must be `postgres`. `storage` must be `s3`. If `storage` is `local`, the bucket variables were not seen, and uploads would disappear on the next deploy. Stop and fix them before you go on.

## 8. Create your master account (once)

1. Open the app service in Railway.
2. Open the **Shell** tab. It is a terminal attached to the running app. (If you do not see it, use the Railway CLI from your computer: `railway link` in the `hearts-prototype` folder, then `railway ssh`.)
3. Paste this and press Enter:

```bash
npm run bootstrap
```

4. It prints `Created the master admin` and your email. The password is not printed.
5. Run the same command again. It should say a master admin already exists and that it did not change the password. That is the one-time behaviour. It will not reset your password on the next deploy.

The app will not start if an account ending in `@hearts.test` is in the database. Those are the demo accounts, and their passwords are in the README. Bootstrap will also refuse those passwords and those email addresses.

## 9. Load the starter talks

In the same shell:

```bash
npm run seed:starters
```

Leave it running. It can take several minutes. It is finished when it says the starter talks are loaded and that no demo accounts were created.

To make the **hearts-demo** portal look lived-in for a phone walkthrough, run this in the same shell after the talks are loaded:

```bash
npm run demo:walkthrough
```

It only writes `hearts-demo`. It does not wipe anything. Run it again if you like; a second run does not add copies. The named learner, the join path, and what the Garden should show are in `docs/DEMO-WALKTHROUGH.md`.

What this does:

- Loads the clauses, the library, and the starter talks.
- Does not create `master@hearts.test` or any other `@hearts.test` account.
- Does not wipe anything. Running it again updates what is already there. It does not delete people you add later.

The talks arrive as drafts. On the master desk, open the opening settings if you want learners to see them before a person has checked each one. The switch is “Show unchecked talks”. Leave it off if you want to approve talks first.

Do **not** run `npm run seed` or `npm run reseed` here. Those create the demo accounts and, in the case of reseed, wipe the database. The live server refuses both. Do not look for a way around that.

## 10. Sign in

1. Open `https://your-domain/login`.
2. Use `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`.
3. You should land on the master desk.

Sign-in cookies are marked Secure and HttpOnly. They are only sent over HTTPS.

## 11. Add your own domain later

You can use the `.up.railway.app` address for as long as you like.

When you have a domain:

1. Open the app service, **Settings**, **Networking**, **Custom Domain**, and type the name (for example `learn.example.com`).
2. Railway shows a `CNAME` record. At the company you bought the domain from, add that record. Railway’s page explains the exact host and value. Wait until it says the certificate is ready. That can take a few minutes, sometimes an hour.
3. Change `SERVER_URL` to `https://learn.example.com` with no slash at the end.
4. Let it redeploy. Sign-in and form posts use `SERVER_URL`, so the old value would reject the new name.
5. If you still want the `.up.railway.app` address to work as well, add it as `ADDITIONAL_ORIGINS` (the full `https://` address, no slash). Otherwise you can leave that unset.

## 12. Back up the database

Do this before you invite people, and then once a week.

**On Railway**

1. Open the **Postgres** service.
2. If you see a **Backups** tab, open it and create a backup. Keep the ones Railway stores. This is the backup to rely on.

**A copy you can download**

Use this when you want a file of your own, or when the plan has no Backups tab.

1. Open the Postgres service, **Settings**, **Networking**, and enable public networking. Railway shows `DATABASE_PUBLIC_URL`.
2. On your computer, with Docker installed, paste the public address into the first line and run both lines. They write `hearts-backup.sql` in the current folder.

```bash
export DATABASE_PUBLIC_URL='paste-the-public-address-here'
docker run --rm -e DATABASE_PUBLIC_URL postgres:16-alpine sh -c 'pg_dump --dbname="$DATABASE_PUBLIC_URL" --no-owner --no-acl' > hearts-backup.sql
```

3. Check that `hearts-backup.sql` is not empty (it should be many kilobytes once the talks are loaded).
4. Go back to Railway and **disable public networking**. Do not leave the database open to the internet.
5. Keep the file somewhere private. It contains every account and every answer.

The bucket is separate from the database. A database backup does not contain the uploaded files. Railway keeps the bucket across deploys. If you ever need a copy of the bucket, use the same keys from the Variables page with any S3 client. Do not delete the bucket to “tidy up”.

## 13. Updating later

Push to the branch Railway is watching. It builds and deploys on its own. Migrations run as the app starts. They add what is missing. They do not wipe the database, and they do not reseed.

Your master password is not reset by a deploy. Bootstrap does not need to be run again.

## If something goes wrong

- `/api/health` does not load: open the deploy log. The first error is the one to fix. A line that starts with `HEARTS cannot start` lists every missing variable at once.
- The health page says `storage` is `local`: the bucket variables are missing or misnamed. Fix them and redeploy before anyone uploads.
- Sign-in says the email or password did not match: use the bootstrap email and password, not the README demo ones. The demo ones are rejected on purpose.
- The shell command failed halfway through the talks: run `npm run seed:starters` again. It continues from what was saved.
- You made a second master by mistake: sign in as the first one and remove the extra account from the desk. Do not run bootstrap hoping it will reset a password. It will not.

## Render (if you are not using Railway)

`render.yaml` at the root of the repository describes a Docker web service and a Postgres database.

1. Create a Render account and a Blueprint from this repository.
2. Render will ask you to fill the variables marked secret: `SERVER_URL`, the `S3_*` values, and the bootstrap email and password. `PAYLOAD_SECRET` is generated for you. Replace it if you want your own, and keep it.
3. Render does not sell a bucket. Create one at Cloudflare R2 or Amazon S3, and paste its endpoint, region, bucket name, and keys into the `S3_*` variables. Set `S3_FORCE_PATH_STYLE` to `1` only if that provider says to use path-style addresses (MinIO does; Amazon usually does not).
4. `HEARTS_TRUSTED_PROXY_HOPS` is already `1` in the blueprint. Leave it.
5. After the service is live, open its shell and run the same two commands: `npm run bootstrap`, then `npm run seed:starters`.
6. Set `SERVER_URL` to the `https://` address Render gives you, then run the two commands.

## Fly (if you are not using Railway)

`hearts-prototype/fly.toml` is a starting point. From the `hearts-prototype` folder:

1. Install the Fly command and sign in (`fly auth login`).
2. Create the app with `fly launch` and accept the existing Dockerfile and `fly.toml`. Say no if it offers to overwrite them.
3. Create a Postgres database (`fly postgres create`, or use another Postgres you already have) and attach it so `DATABASE_URL` is set on the app.
4. Create an S3-compatible bucket (Fly Tigris, Cloudflare R2, or Amazon S3). Set `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, and `S3_ENDPOINT` with `fly secrets set`.
5. Set `PAYLOAD_SECRET`, `SERVER_URL`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` the same way. `SERVER_URL` is `https://` plus the app’s `fly.dev` name, or your domain.
6. You do not set `HEARTS_TRUSTED_PROXY_HOPS` on Fly. Fly sends the visitor’s address in `Fly-Client-IP` and ignores a fake one. The app uses that header when it can see it is running on Fly.
7. Leave `min_machines_running` at 1. Do not let the machine stop when idle. The join limits live in that one process, and a cold start is a poor welcome.
8. Deploy with `fly deploy`. Then `fly ssh console` and run `npm run bootstrap` and `npm run seed:starters`.

Give the machine 1 GB of memory, which the `fly.toml` already requests.

## Variables, in one list

| Variable | Required on the live server | What it is |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres address. `postgres://…` |
| `DATABASE_ADAPTER` | No | `postgres` or `sqlite`. If you omit it, the address decides. |
| `PAYLOAD_SECRET` | Yes | Long random string, 32 characters or more. |
| `SERVER_URL` | Yes | Public `https://` address, no slash at the end. |
| `ADDITIONAL_ORIGINS` | No | Extra `https://` addresses, separated by commas, if more than one name should work. |
| `HEARTS_TRUSTED_PROXY_HOPS` | Yes on Railway and Render | `1` there. `0` only if nothing sits in front of the app. |
| `HEARTS_CLIENT_IP_HEADER` | On Fly it is automatic | A header the platform itself sets. Do not set this to `x-forwarded-for` or `x-real-ip`. Those can be faked. Fly’s header is `fly-client-ip`. |
| `S3_BUCKET` or `BUCKET` | Yes | Bucket name. |
| `S3_ACCESS_KEY_ID` or `ACCESS_KEY_ID` or `AWS_ACCESS_KEY_ID` | Yes | Bucket key id. |
| `S3_SECRET_ACCESS_KEY` or `SECRET_ACCESS_KEY` or `AWS_SECRET_ACCESS_KEY` | Yes | Bucket secret. |
| `S3_REGION` or `REGION` or `AWS_REGION` | Usually | `auto` on Railway. A real region on Amazon, such as `eu-west-2`. |
| `S3_ENDPOINT` or `ENDPOINT` or `AWS_ENDPOINT_URL` | Yes for Railway, R2, MinIO | The S3 address. Leave unset for Amazon’s own S3. |
| `S3_FORCE_PATH_STYLE` | No | `1` for MinIO. Leave unset for Railway and Amazon. |
| `BOOTSTRAP_ADMIN_EMAIL` | For the one-time command | Your email. |
| `BOOTSTRAP_ADMIN_PASSWORD` | For the one-time command | Your password, 12 characters or more, not a demo password. |
| `BOOTSTRAP_ADMIN_NAME` | No | Name on the account. |
| `NODE_ENV` | Set by the image | `production`. Do not set it to `development` on the live server. |

On your own computer you can ignore all of these. `npm run dev` uses SQLite, stores uploads in the `media` folder, and does not require a secret.
