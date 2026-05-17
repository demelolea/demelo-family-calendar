# Deployment Guide

## Step 1 — Set up Supabase

1. Go to [supabase.com](https://supabase.com) and open your project
2. Navigate to **SQL Editor**
3. Paste the contents of `schema.sql` and click **Run**
4. Confirm the tables appear in **Table Editor**

> **Realtime:** In your Supabase dashboard, go to **Database → Replication** and make sure all four tables (`events`, `locations`, `phoebe_schedule`, `guests`) are enabled under the `supabase_realtime` publication.

---

## Step 2 — Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## Step 3 — Deploy to Vercel

### Option A: Via Vercel CLI

```bash
npm i -g vercel
vercel
```

Follow the prompts. When asked for environment variables, add both from `.env.local`.

### Option B: Via GitHub

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repository
4. Framework will be auto-detected as **Next.js**
5. Under **Environment Variables**, add:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://liucarfbszeeeyweyluu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci…` (your full anon key) |

6. Click **Deploy**

Vercel will give you a URL like `https://demelo-calendar.vercel.app` — share that with all family members.

---

## Sharing with family

No login required. Just send the Vercel URL. Changes made by anyone are instantly visible to everyone via Supabase Realtime.

For a nicer URL, add a custom domain in Vercel settings.

---

## Local development notes

- `npm run dev` — starts on http://localhost:3000
- `npm run build` — production build (runs automatically on Vercel)
- The green dot in the header indicates the realtime connection is live
