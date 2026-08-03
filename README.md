# GroceryMind — Setup Guide

## Prerequisites
- GitHub account, Vercel account, Supabase account, Node.js installed locally

---

## Step 1 — Set up the database (Supabase)

1. Open your Supabase project → **SQL Editor** → **New query**
2. Open `supabase-schema.sql` from this project, copy all contents, paste and **Run**
3. You should see "Success. No rows returned"

Default login seeded: username `admin`, password `password` — **change immediately**

---

## Step 2 — Get your Supabase keys

Go to **Settings → API** in your Supabase project and copy:
- Project URL
- anon/public key  
- service_role key (secret — never share)

---

## Step 3 — Set up locally

```bash
cd grocerymind
npm install
cp .env.local.example .env.local
# Fill in .env.local with your keys
npm run dev
```

Open http://localhost:3000 — login with `admin` / `password`

---

## Step 4 — Deploy to Vercel

```bash
git init && git add . && git commit -m "Initial GroceryMind"
# Push to a new GitHub repo, then import in Vercel
# Add all 5 env variables in Vercel settings before deploying
```

---

## Step 5 — First login steps

1. Login → Admin tab → create your real account
2. Log out, log back in with new credentials  
3. Create your partner's account from Admin
4. Delete the default `admin` account

---

## Install as PWA

**iPhone:** Safari → Share → Add to Home Screen  
**Android:** Chrome → Menu → Add to Home Screen

---

## What's in this build

- Login/logout, two users, shared household
- Dashboard with today's menu + pantry alerts  
- 7-day meal plan with options per slot, add/remove dishes
- Pantry with shelf view, mark Good/Low/Finished
- Order list with real-time sync between both users
- Admin panel to create household members
- PWA-ready, installs on phone

## Coming next
- LLM ingredient parsing, smart order suggestions, dish discovery
