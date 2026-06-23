# Supabase setup — Mun web auth + cloud sync

One-time setup you do in the Supabase dashboard. Gives the app real accounts
(email/password + Google) and per-user cloud storage for transactions, watchlist,
and settings. Holdings are derived from transactions client-side (no cash).

## 1. Create the project
1. https://supabase.com → sign in → **New project** (free tier).
2. Pick a name + a region close to you (e.g. Southeast Asia / Singapore).
3. After it provisions, go to **Project Settings → API** and copy:
   - **Project URL**  (e.g. `https://abcd1234.supabase.co`)
   - **anon / public** key  (a long JWT — this is safe to ship in client JS; Row
     Level Security below is what actually protects each user's data)

## 2. Create tables + security
Open **SQL Editor → New query**, paste this, click **Run**:

```sql
-- transactions: the source of truth; holdings are derived from these
create table transactions (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  sym       text not null,
  side      text not null check (side in ('buy','sell')),
  qty       numeric not null,
  price_usd numeric not null,           -- USD-canonical, like the rest of the app
  ts        timestamptz not null default now()
);

-- starred watchlist items
create table watchlist (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  sym     text not null,
  primary key (user_id, sym)
);

-- per-user settings (theme / currency / notifications)
create table prefs (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  dark    boolean not null default false,
  cur     text    not null default 'thb',
  notif   boolean not null default true
);

-- Row Level Security: each user can only see/touch their own rows
alter table transactions enable row level security;
alter table watchlist    enable row level security;
alter table prefs         enable row level security;

create policy "own rows" on transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on watchlist
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

## 3. Auth settings
- **Authentication → URL Configuration**: add `https://mun-3skf.onrender.com` to
  **Site URL** and to **Redirect URLs**. (Also add `http://localhost:*` if you ever
  test locally.)
- Email/password works immediately. To skip the confirmation-email step while testing:
  **Authentication → Providers → Email** → turn **Confirm email** off (turn back on later).

## 4. Google sign-in (optional — can add later)
- **Authentication → Providers → Google** → enable.
- It shows a **Callback URL** like `https://<project>.supabase.co/auth/v1/callback`.
- In Google Cloud Console → **APIs & Services → Credentials → Create OAuth client ID**
  (Web application) → add that callback URL under *Authorized redirect URIs* → copy the
  **Client ID** + **Client secret** back into the Supabase Google provider form → save.

## 5. Hand me two values
Paste the **Project URL** and the **anon public key** back to me. I'll drop them into
`web/supabase.js` and wire the login gate. (If you skip Google for now, the Google
button just won't work until step 4 is done — email/password is enough to ship.)
