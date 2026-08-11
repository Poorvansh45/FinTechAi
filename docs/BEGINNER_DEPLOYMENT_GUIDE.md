# Beginner Deployment Guide

**Who this is for:** someone who has never deployed a full-stack application. No prior knowledge of Git,
GitHub, environment variables, APIs, databases, or hosting is assumed. Every term is explained the first
time it appears.

**Companion document:** [`DEPLOYMENT_MASTER_PLAN.md`](./DEPLOYMENT_MASTER_PLAN.md) — the same deployment,
written as a technical reference. Come back to it when you want the *why*.

**Roughly how long:** 2–4 hours, most of it waiting. The OHLCV migration in Step 7 is the longest single
wait.

---

## 🔴 Read this before anything else

**Never put a real password, API key, or database connection string into:** a file you commit to Git, a
chat message to Claude, a screenshot, or any document. Real values are typed **only** into a hosting
dashboard or into a local `.env` file that Git already ignores.

Whenever you see something like `<YOUR_JWT_SECRET>` in this guide, that is a **placeholder**. Do not type
those angle brackets. Replace the whole thing with your real value.

---

## The words you need

Read this once. You do not have to memorise it — come back when a term confuses you.

| Term | What it actually means |
|---|---|
| **Frontend** | The part that runs in your browser — what you see and click. Here: Next.js. |
| **Backend** | A program on a server that the frontend talks to. This app has **two**: Express and FastAPI. |
| **API** | The set of URLs a backend answers on. The frontend "calls the API" to get data. |
| **Git** | Software that tracks changes to files on your computer. |
| **GitHub** | A website that stores Git projects online. Render and Vercel read your code from here. |
| **Repository (repo)** | One project's folder, tracked by Git. Yours is `FinTechAi`. |
| **Branch** | A named version of the code. Yours are `main` and `akarsh-feature`. |
| **Commit** | A saved snapshot of your changes. |
| **Push** | Sending your commits to GitHub. |
| **Deploy** | Copying your code onto a server on the internet so other people can use it. |
| **Production** | The live version real people use, as opposed to the copy on your laptop. |
| **Build** | Converting source code into the optimised files a server actually runs. |
| **Environment variable** | A named setting given to a program from outside its code — like `MONGODB_URI`. This is how secrets stay out of the code. |
| **`.env` file** | A local text file holding environment variables. **Never committed to Git.** |
| **Secret** | Any value that would let someone impersonate you or read your data. Passwords, API keys, database strings. |
| **API key** | A long random string proving to another company's service that you're allowed to use it. |
| **Database** | Where the app permanently stores users, watchlists, and price history. Here: MongoDB. |
| **MongoDB Atlas** | MongoDB's own cloud hosting. You do not install anything. |
| **Cluster** | Atlas's word for one hosted database server. You need the free "M0" one. |
| **Connection string / URI** | One long string containing the address, username, and password for your database. **This is a secret.** |
| **Render** | A hosting company. It will run your two backends. |
| **Vercel** | A hosting company built for Next.js. It will run your frontend. |
| **JWT** | "JSON Web Token" — a signed string the server gives your browser to prove you're logged in. |
| **`JWT_SECRET`** | The password the server uses to sign those tokens. **Both backends must have the exact same one.** |
| **Cookie** | A small piece of data the browser stores for a website. Your login token lives in one. |
| **CORS** | A browser rule: a page on site A can only call site B if site B says it's allowed. Misconfigure it and the browser blocks your own requests. |
| **CSV** | A plain text spreadsheet file. Here, ~124 MB of daily stock price history. |
| **OHLCV** | Open, High, Low, Close, Volume — one row of daily price data per stock per day. |
| **Migration** | Copying data from one storage place to another. Here: from the CSV on your laptop into MongoDB. |
| **Seeding** | Creating the initial user accounts in a fresh database. |
| **Health check** | A URL like `/health` a host calls repeatedly to see if your service is alive. |
| **Cold start** | The delay when a sleeping free-tier server wakes up. Tens of seconds. Normal. |
| **DNS** | The system turning names like `google.com` into server addresses. **You don't need to touch it** — Vercel and Render give you working URLs for free. |

---

## Who does what

Throughout this guide, every step is labelled:

- 🧑 **USER MUST DO THIS** — only you can. It needs your accounts, your browser, or your password.
- 🤖 **CLAUDE CAN DO THIS** — Claude can do it from the repository. Ask it to.
- 🤝 **USER + CLAUDE** — you run it; Claude reads the output and tells you what it means.

**The hard limit:** Claude has **no connection to your Render, Vercel, MongoDB Atlas, or GitHub
dashboards.** It cannot log into them, cannot click Deploy, cannot create your database, and cannot see
your logs unless you copy and paste them into the chat. Every dashboard action in this guide is yours.

What Claude *can* do: read every file in this repository, explain what a setting does, tell you exactly
which values to enter, run the local test suites, and diagnose an error message you paste back.

---

## How to use the Claude prompts

At most steps you'll see a box like this:

> **PROMPT TO CLAUDE** *(inspect only — Claude must not modify files)*
> ```
> Some text to copy and paste.
> ```

Copy the text inside, paste it into Claude, press enter. Each prompt states whether Claude may change files
or only look. **If a prompt says "inspect only", and Claude starts editing files, stop it.**

---

## Terminal basics for Windows

You will type commands into a **terminal** — a window where you type instructions instead of clicking.

**To open PowerShell:** press the Windows key, type `powershell`, press Enter.

**Two things to know:**

1. **The current directory matters enormously.** Commands run *where you are*. Running the right command in
   the wrong folder is the most common beginner failure in this guide, and several of the scripts here fail
   *silently* — they connect to the wrong database instead of erroring. Always check where you are:

   ```bash
   cd
   ```

   In PowerShell, bare `cd` prints the current directory. In CMD it does the same. To move somewhere:

   ```bash
   cd C:\path\to\FinTechAi
   ```

   Replace `C:\path\to\FinTechAi` with your real project path everywhere in this guide.

2. **PowerShell vs CMD.** For everything in this guide, `cd`, `node`, `python`, `npm`, and `git` behave
   identically in both. Where a difference matters, it's called out explicitly. Windows accepts both
   backslashes (`cd backend\fastapi_app`) and forward slashes (`cd backend/fastapi_app`).

**Checking your tools exist.** Run these three:

```bash
node --version
```

```bash
python --version
```

```bash
git --version
```

**Expected:** `node` v20 or higher, `python` 3.11 or higher, and any `git` version.

**If a command isn't recognised:** that tool isn't installed or isn't on your PATH. Install Node from
<https://nodejs.org> (LTS version), Python from <https://www.python.org/downloads/> — and on the Python
installer's **first screen, tick "Add Python to PATH"**, which is easy to miss. Close and reopen your
terminal after installing.

> If `python --version` prints something like "Python was not found" and opens the Microsoft Store, Windows
> has a stub in the way. Install real Python from python.org and reopen the terminal.

---

# STEP 0 — Understand what you are building

**🧑 USER — reading only, nothing to do**

You are putting four things online:

| Piece | Where it will live | What it does |
|---|---|---|
| Next.js frontend | **Vercel** | The website people visit |
| Express backend | **Render** | Login, accounts, tokens |
| FastAPI backend | **Render** | Scanners, analytics, AI copilot |
| MongoDB database | **MongoDB Atlas** | Stores everything permanently |

They connect like this:

```
   Your browser
        │
        ▼
   Vercel (the website)
        │
        ├──────► Render: Express  ──────┐
        │        (login, tokens)        │
        │                               ▼
        └──────► Render: FastAPI ──► MongoDB Atlas
                 (scanners, AI)
```

**Two facts that explain most of what follows:**

1. Express is the only service that *creates* login tokens. FastAPI only *checks* them. Both need the
   **exact same** `JWT_SECRET` to agree. If they differ, login works and everything else fails with an
   error code 401.
2. The frontend's backend addresses are **baked in when the site is built**, not read while it runs.
   Changing them later does nothing until you rebuild. You will see this warning several more times,
   because it catches everyone once.

**Expected result:** you understand the shape of it. That's all.

**Then continue to Step 1.**

---

# STEP 1 — Check the app is healthy before you deploy

**🤝 USER + CLAUDE**

Deploying broken code just moves the breakage somewhere harder to debug. Check first.

> **PROMPT TO CLAUDE** *(inspect and run tests only — Claude must NOT modify any files)*
> ```
> Run the local verification suite for this repo and report the results. Do not modify any files.
> Run, in order:
>   1. cd frontend && npm run typecheck
>   2. cd backend && npm test
>   3. cd backend/fastapi_app && python -m pytest tests/ -q
> Tell me for each whether it passed, and if anything failed, paste the exact error and explain what it
> means in plain language. Do not attempt to fix anything yet — just report.
> ```

**WHAT I DO:** paste that prompt, wait, read the summary.

**If you'd rather run them yourself:**

**WHERE TO RUN:** PowerShell
**CURRENT DIRECTORY:** `C:\path\to\FinTechAi\frontend`

```bash
npm run typecheck
```

**EXPECTED OUTPUT:** nothing at all, then your prompt returns. Silence means success.

Then:

**CURRENT DIRECTORY:** `C:\path\to\FinTechAi\backend`

```bash
npm test
```

**EXPECTED OUTPUT:** a summary ending with lines like `# pass 3` and `# fail 0`.

Then:

**CURRENT DIRECTORY:** `C:\path\to\FinTechAi\backend\fastapi_app`

```bash
python -m pytest tests/ -q
```

**EXPECTED OUTPUT:** a row of dots and a line like `12 passed in 3.41s`.

> ⚠️ **Do not run `npm run build` in the frontend on Windows.** That script is written for Linux/Mac
> (`NODE_ENV=production next build`) and Windows will reject it with
> `'NODE_ENV' is not recognized as an internal or external command`. **This is not a bug in your code** —
> Vercel builds on Linux, where it works fine. `npm run typecheck` catches the same class of errors.

**STOP HERE if:** the FastAPI or Express tests fail. Those are the tests protecting your login security.
Paste the failure to Claude before continuing.

**It's OK to continue if:** only `npm run lint` complains — there is no ESLint config committed yet, and CI
treats lint as non-blocking.

**Then continue to Step 2.**

---

# STEP 2 — Make sure no secrets are about to be published

**🤝 USER + CLAUDE**

Once code is on GitHub, assume anything in it has been seen. This check takes 30 seconds and is not
optional.

**WHERE TO RUN:** PowerShell
**CURRENT DIRECTORY:** `C:\path\to\FinTechAi`

```bash
git status
```

**EXPECTED OUTPUT:**

```
On branch akarsh-feature
nothing to commit, working tree clean
```

**WHAT TO LOOK FOR — stop immediately if you see any of these listed:**

- ❌ `backend/.env` or `frontend/.env` — these hold your real keys
- ❌ `backend/data/Stock_Data.csv` — 124 MB; GitHub rejects files over 100 MB anyway
- ❌ any file with `secret`, `key`, `password`, or `credential` in the name

**Files that are fine to see:** `backend/.env.example` and `backend/fastapi_app/.env.example`. The word
`example` matters — these are templates with **empty** value fields, and they're meant to be committed.

Confirm nothing sensitive is tracked:

```bash
git ls-files | findstr /I ".env"
```

**EXPECTED OUTPUT — exactly these two lines and nothing else:**

```
backend/.env.example
backend/fastapi_app/.env.example
```

> `findstr` is the Windows equivalent of `grep`. It works in both PowerShell and CMD.

**IF IT FAILS** — a real `.env` shows up — **stop.** Do not push.

> **PROMPT TO CLAUDE** *(inspect only — do not modify or delete anything)*
> ```
> `git status` / `git ls-files` shows a file I think might contain secrets. Here is the output:
>
> [paste the output — but redact any actual secret values first]
>
> Tell me whether this file is safe to commit, what .gitignore rule should cover it, and what I should do
> next. Do not modify or delete anything — just advise.
> ```

**Then continue to Step 3.**

---

# STEP 3 — Put your code on GitHub

**🧑 USER MUST DO THIS**

Render and Vercel do not read your laptop. They read GitHub.

**WHERE TO RUN:** PowerShell
**CURRENT DIRECTORY:** `C:\path\to\FinTechAi`

Check where your code goes:

```bash
git remote -v
```

**EXPECTED OUTPUT:**

```
origin  https://github.com/Poorvansh45/FinTechAi (fetch)
origin  https://github.com/Poorvansh45/FinTechAi (push)
```

Check which branch you're on:

```bash
git branch --show-current
```

**EXPECTED OUTPUT:** `akarsh-feature`

### Choose your deployment branch — do this now

You need to decide **one** branch that both Render and Vercel will deploy from. Two reasonable choices:

- **Merge into `main` and deploy `main`.** This is conventional, and automated tests (CI) already run on
  `main`. More steps.
- **Deploy `akarsh-feature` directly.** Fewer steps. No CI runs on this branch.

Either works. **What matters is using the same branch on both hosts** — otherwise your frontend and
backends drift out of sync and you'll debug a mismatch that isn't in the code.

Push whatever branch you chose:

```bash
git push origin akarsh-feature
```

**EXPECTED OUTPUT:** a few lines ending in something like
`akarsh-feature -> akarsh-feature`, or `Everything up-to-date`.

**IF IT FAILS** with an authentication error: GitHub no longer accepts account passwords over HTTPS. You
need a Personal Access Token — see <https://docs.github.com/en/authentication>. This is a GitHub account
matter that Claude cannot do for you.

**Expected result:** opening `https://github.com/Poorvansh45/FinTechAi` in a browser shows your latest
changes on that branch.

**Then continue to Step 4.**

---

# STEP 4 — Create your database on MongoDB Atlas

**🧑 USER MUST DO THIS** — Claude has no Atlas access.

MongoDB Atlas hosts your database. The free tier ("M0") gives 512 MB, and this app needs about 190 MB.

> **Note on button labels.** Atlas redesigns its dashboard regularly. The **section names** below are
> stable; exact button text may differ from what's written here. Look for the section, then the action.

### 4a — Create the account and cluster

1. **Open:** <https://www.mongodb.com/cloud/atlas>
2. **Sign up** (or sign in). Signing in with Google is fine.
3. Create a project when prompted. Name it anything — `Nivro` works.
4. Look for the option to **deploy a new cluster** or **build a database**.
5. **Choose the M0 / Free tier.** It may be labelled "Free", "Shared", or "M0". **Do not pick a paid
   tier** — you will be charged.
6. **Choose a region.** Pick something in the **US, near Ohio** — your backends will run in Render's Ohio
   region, and physical distance directly costs you scan speed.
7. Create it. Provisioning takes 1–3 minutes.

**Expected result:** a cluster appears in your dashboard, eventually showing as active.

### 4b — Create a database user

This is a login **for the database itself**, completely separate from the app's user accounts.

1. Find the **Database Access** section in the left sidebar.
2. Add a new database user.
3. **Username:** something simple like `finai_app`.
4. **Password:** use the **Autogenerate** option if offered.
   - ⚠️ **Use letters and numbers only.** If the password contains `@`, `:`, `/`, or `?`, it breaks the
     connection string format and you'll get a confusing parse error later.
5. **Give it read and write access** to the database.
6. **Copy the password somewhere safe right now.** Atlas will not show it to you again. Use a password
   manager, or a file that is *not* inside this project folder.

**❌ WHAT NOT TO DO:** do not reuse a password from another service. Do not put it in any file inside the
project. Do not paste it into a chat.

**Expected result:** the user is listed under Database Access.

### 4c — Allow Render to connect

By default Atlas blocks every network address. Your backends need through.

1. Find the **Network Access** section (sometimes called IP Access List).
2. Add an entry.
3. Choose the option meaning **allow access from anywhere** — `0.0.0.0/0`.

**Why this, and what it costs you:** Render's free tier doesn't give your services a fixed internet
address, so there's no specific address to allow. `0.0.0.0/0` means the network layer stops filtering
entirely, and **your database password becomes the only thing protecting your data.** That's why Step 4b
insisted on a strong, unique, never-committed password. It is a real trade-off, made knowingly.

**Expected result:** an entry showing `0.0.0.0/0`.

### 4d — Get your connection string

1. Find the **Connect** action on your cluster.
2. Choose the option for connecting an **application / driver**.
3. Copy the string. It looks like:

   ```
   mongodb+srv://finai_app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

4. **Edit it in a plain text editor** (Notepad is fine — not inside the project folder):
   - Replace `<password>` — including the angle brackets — with your real password from Step 4b.
   - **Insert `finai_edge` between the `/` and the `?`.** This names the database.

   The finished string looks like:

   ```
   mongodb+srv://finai_app:YourRealPassword@cluster0.xxxxx.mongodb.net/finai_edge?retryWrites=true&w=majority
   ```

> ⚠️ **Do not skip adding `finai_edge`.** Without it, your two backends can quietly end up using *different*
> databases. Nothing errors — you just get logins that work against empty data and scanners that find
> nothing. This is one of the nastiest failure modes in this whole guide because it looks like success.

**Keep this string safe. It contains your password — it is a secret.**

**Expected result:** one complete connection string, saved somewhere outside the project.

**STOP HERE if:** you don't have the password. Go back to Database Access and either edit the user to set a
new password, or create a new user.

**Then continue to Step 5.**

---

# STEP 5 — Point your laptop at the new database

**🧑 USER MUST DO THIS**

Two important jobs — copying the price data (Step 7) and creating user accounts (Step 8) — run **from your
laptop**, writing to Atlas over the internet. So your laptop needs the connection string.

1. Open the file `backend\.env` in a text editor.
   - This file is already ignored by Git — verified in `.gitignore`. It will not be committed.
   - **If it doesn't exist:** copy `backend\.env.example` to `backend\.env` and fill it in.

2. Find the line starting with `MONGODB_URI=` and replace the whole value with your Atlas string:

   ```
   MONGODB_URI=mongodb+srv://finai_app:YourRealPassword@cluster0.xxxxx.mongodb.net/finai_edge?retryWrites=true&w=majority
   ```

   No quotes. No spaces around the `=`.

3. **Before you close the file, note what you've just done.** From now on, any script you run locally that
   reads this file will touch **production data**. That is exactly what Steps 7 and 8 need — but keep it in
   mind afterwards.

> 💡 **Optional but sensible:** first save a copy of your original local `MONGODB_URI` line somewhere, so
> you can switch back to local development later.

### While you're here — generate your JWT_SECRET

This is the password your two backends use to sign login tokens. You need it in Step 9, and it must be
identical on both.

**WHERE TO RUN:** PowerShell
**CURRENT DIRECTORY:** anywhere

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**EXPECTED OUTPUT:** one long line of random characters, roughly 64 characters.

**Copy it somewhere safe** — the same place as your database password. You'll paste it into Render twice,
identically.

**❌ Do not** put this in any file in the project. **❌ Do not** paste it into a chat. **❌ Do not** type it
by hand into the second Render service — copy and paste, so a typo can't cause a mismatch.

**Expected result:** `backend\.env` has the Atlas URI; you have a `JWT_SECRET` saved safely.

**Then continue to Step 6.**

---

# STEP 6 — Understand the price data problem

**🧑 USER — reading only**

The scanners need years of daily prices for ~2,200 stocks. On your laptop that's a file:
`backend\data\Stock_Data.csv`, about **124 MB**.

**That file cannot go to the server.** It's deliberately excluded from Git (GitHub rejects files over
100 MB), and Render's servers wipe their disk on every restart anyway.

So production reads the same data **from MongoDB** instead. The setting that picks between them:

```
On your laptop:   OHLCV_BACKEND=csv      ← the default; nothing to change
On the server:    OHLCV_BACKEND=mongo    ← already set in render.yaml
```

Step 7 copies the CSV into MongoDB so the server has something to read.

**Three things to hold onto:**

1. **❌ Never delete `Stock_Data.csv`.** It's your safety net. If MongoDB ever misbehaves locally, flipping
   one setting back to `csv` restores the old behaviour instantly. The migration script opens it read-only
   and never modifies it.
2. **The migration must finish before the server runs a scan.** If MongoDB is empty and the server tries to
   scan, it would evaluate zero stocks and *publish* that empty result — wiping every working scanner. The
   code has a guard that raises a loud error instead, but don't rely on it.
3. **This is a copy, not a move.** Both sources exist afterwards.

**Then continue to Step 7.**

---

# STEP 7 — Copy the price data into MongoDB

**🧑 USER RUNS · 🤖 CLAUDE CHECKS THE OUTPUT**

This is the longest step. Have something else to do.

**Before starting, confirm Step 5 is done** — `backend\.env` must contain your Atlas URI. The script finds
it by looking one folder up from where you run it, so **the folder you run from matters**.

### 7a — Smoke test with 50 stocks first

**WHERE TO RUN:** PowerShell
**CURRENT DIRECTORY:** `C:\path\to\FinTechAi\backend\fastapi_app`

```bash
cd C:\path\to\FinTechAi\backend\fastapi_app
```

```bash
python scripts/migrate_ohlcv_to_mongo.py --limit 50
```

**EXPECTED OUTPUT:**

```
source : C:\...\backend\data\Stock_Data.csv  (124 MB)
target : MongoDB 'ohlcv'  (CSV is read-only here)

wrote 50 symbols / 51,204 bars in 8.3s
collection now: 50 symbols, 51,204 bars, 2021-07-11 -> 2026-08-06
```

**Why bother:** it proves your connection string works before you commit to a 5-minute run.

**IF IT FAILS:**

| Error contains | Meaning | Fix |
|---|---|---|
| `CSV not found` | wrong folder, or the file was moved | confirm `backend\data\Stock_Data.csv` exists |
| `ServerSelectionTimeoutError` | can't reach Atlas | check Network Access is `0.0.0.0/0` (Step 4c) |
| `Authentication failed` | wrong username/password | re-check the URI in `backend\.env` |
| `InvalidURI` / parse error | password has a special character | regenerate the Atlas password using letters and digits only |
| `ModuleNotFoundError` | Python packages missing | run `pip install -r requirements.txt` in this folder |

### 7b — The real migration

```bash
python scripts/migrate_ohlcv_to_mongo.py
```

**This takes several minutes** and prints progress as it goes. Leave it alone.

**EXPECTED OUTPUT — the shape, not the exact numbers:**

```
source : C:\...\backend\data\Stock_Data.csv  (124 MB)
target : MongoDB 'ohlcv'  (CSV is read-only here)

    200 symbols ·   210,433 bars ·  18.4s
    400 symbols ·   421,880 bars ·  35.9s
    ...

wrote 2207 symbols / 2,256,535 bars in 214.7s
collection now: 2207 symbols, 2,256,535 bars, 2021-07-11 -> 2026-08-06

verifying MongoDB against C:\...\backend\data\Stock_Data.csv

mongo :  2207 symbols   2,256,535 bars
csv   :  2207 symbols   2,256,535 bars

exact value check on 40 symbols...

PASSED — MongoDB matches the CSV exactly (bar counts and values).
The CSV is unchanged and remains a valid rollback: ohlcv_backend="csv".
```

**✅ Success is the word `PASSED`.** The script migrates and then verifies automatically — you don't need
a separate check.

`PASSED` means every single value matches **exactly**, not approximately. The check is deliberately strict:
prices are stored in a format that survives the round-trip perfectly, so any difference at all would be a
real defect rather than rounding.

**IF IT WAS INTERRUPTED** (you closed the window, the connection dropped):

```bash
python scripts/migrate_ohlcv_to_mongo.py --resume
```

`--resume` skips stocks already stored, so you don't start over.

**TO RE-CHECK LATER without writing anything:**

```bash
python scripts/migrate_ohlcv_to_mongo.py --verify
```

> **PROMPT TO CLAUDE** *(inspect only — do not modify files or re-run the migration)*
> ```
> I ran the OHLCV migration. Here is the complete output:
>
> [paste everything the script printed]
>
> Tell me: did it fully succeed? Do the symbol and bar counts look right for this project? Is there
> anything I should re-run before deploying? Inspect only — do not modify any files and do not run the
> migration yourself.
> ```

**STOP HERE if:** you did not see `PASSED`. Everything downstream depends on this data being complete.

**❌ WHAT NOT TO DO:**
- Do not delete or move the CSV afterwards.
- Do not run this from the project root folder — it would miss your Atlas URI and quietly write to a local
  database instead.
- Do not commit the CSV.

**Then continue to Step 8.**

---

# STEP 8 — Create the user accounts

**🧑 USER MUST DO THIS** — Claude cannot type passwords, and shouldn't ever see one.

This app has **no sign-up page**. That's deliberate: it's a private beta, so the registration route was
removed from the code entirely rather than hidden behind a setting. Every account is created by a script.

### ⚠️ The mistake that silently ruins this step

The seeding scripts look for a `.env` file **in the folder you run them from**. There is no `.env` at the
project root — only at `backend\.env`.

So if you run the script from the project root, it finds no `.env`, falls back to
`mongodb://localhost:27017/finai_edge`, connects successfully to your **local** database, and reports
success. Your Atlas database gets nothing, and nothing warns you.

**Always `cd backend` first.**

### 8a — Preview what will happen

**WHERE TO RUN:** PowerShell
**CURRENT DIRECTORY:** `C:\path\to\FinTechAi\backend`

```bash
cd C:\path\to\FinTechAi\backend
```

```bash
node scripts/seedUsers.js --dry-run
```

`--dry-run` shows what *would* change without changing anything.

**EXPECTED OUTPUT:**

```
[seed] connected to finai_edge  (DRY RUN — no writes)

[seed] created (6)
         poorvanshnandwar145@gmail.com (owner)
         akarshj866@gmail.com (owner)
         friend1@gmail.com (beta)
         friend2@gmail.com (beta)
         friend3@gmail.com (beta)
         demo@fintechai.app (demo)
...
[seed] done.
```

**🔍 CHECK THE FIRST LINE.** `[seed] connected to finai_edge` is your proof you hit Atlas. If it says
anything else, or if you're unsure, you are probably in the wrong folder. Go back and `cd backend`.

### 8b — Apply it

```bash
node scripts/seedUsers.js
```

**EXPECTED OUTPUT:** the same list, without `(DRY RUN)`, ending with:

```
[seed] 6 new account(s) have an unusable random password.
       Set a real one before handing them out:

         node backend/scripts/setPassword.js poorvanshnandwar145@gmail.com
         ...

[seed] done.
```

**What just happened, and why "unusable password" is good news:** each new account was created with a
48-byte random password that the script immediately threw away. Nobody knows it — not even you, not even
the script. The account is unusable until you deliberately set a password. That means no real password ever
existed in a file, in your shell history, or in a log.

For accounts that **already existed**, the script changed only their role and active status. It **never
touches an existing password.** That's what lets an old account whose password nobody remembers keep
working.

The script is safe to run repeatedly.

### 8c — Set a real password for each account

Once per account:

```bash
node scripts/setPassword.js friend1@gmail.com
```

**EXPECTED OUTPUT:**

```
Setting password for friend1@gmail.com (role: beta)
New password:
Confirm password:
Password updated for friend1@gmail.com.
```

**⚠️ Nothing appears as you type — not even asterisks.** Your terminal is not frozen. That's the password
being deliberately hidden from the screen and from your scrollback. Type it and press Enter.

**Rules:** minimum **10 characters**. You'll be asked twice; they must match.

Repeat for every account you plan to hand out.

### 🔒 Where a password may and may not go

**✅ The ONLY acceptable place to type a password is at this hidden prompt.**

**❌ NEVER put a password in:**

- a file in this project — including `.env`, `.env.example`, or the account list in `seedUsers.js`
- a Git commit or commit message
- a chat message to Claude
- a screenshot you share for debugging
- a command-line argument — the script *refuses* to accept one, because arguments are visible to other
  programs and saved in your shell history
- the Render or Vercel dashboards — app user passwords are not environment variables
- any documentation, including this file

Only a scrambled, one-way version of the password (a "hash") is ever stored in the database. Even with full
database access, nobody can read the original.

> **PROMPT TO CLAUDE** *(inspect only — never paste a password)*
> ```
> I ran seedUsers.js against production. Here is the output (no passwords included):
>
> [paste the seed script output]
>
> Confirm the roster matches what backend/scripts/seedUsers.js defines, and tell me which accounts still
> need a password set. Inspect only — do not modify files. Never ask me for a password.
> ```

**Expected result:** every account you intend to use has a password you know.

**Then continue to Step 9.**

---

# STEP 9 — Deploy the two backends to Render

**🧑 USER MUST DO THIS** — Claude has no Render access.

Good news: this repository has a file called `render.yaml` that tells Render nearly everything — what to
build, how to start it, which folder each service lives in. You mainly supply the secrets.

Anything marked `sync: false` in that file is deliberately **not** in the file — that's the mechanism
keeping your secrets out of GitHub. Those are what you type.

### 9a — Create the Blueprint

1. **Open:** <https://render.com>
2. **Sign in with GitHub** — simplest, and it sets up repository access at the same time.
3. Look for the option to create a new **Blueprint**. ("Blueprint" is Render's word for "read the
   `render.yaml` in this repo and set everything up.")
4. Connect the repository **`Poorvansh45/FinTechAi`**. Authorise Render to read it if asked.
5. **Select the branch you chose in Step 3.** Get this right — it's not in `render.yaml`.
6. Render reads the file and proposes **two services**:
   - `finai-edge-backend` (Express)
   - `finai-edge-fastapi` (FastAPI)
7. Approve both.

**Expected result:** both services appear, with build and start commands already filled in.

**IF ONLY ONE SERVICE APPEARS, OR NONE:** Render probably didn't find `render.yaml`. Confirm you selected
the right repository and that you actually pushed in Step 3.

### 9b — Fill in the Express service's secrets

Open `finai-edge-backend` and find its environment variables section.

**Already set from `render.yaml` — do not change:** `NODE_ENV=production`, `PORT=8080`.

**Add these three:**

| Key | Value |
|---|---|
| `MONGODB_URI` | your full Atlas string from Step 4d (including `/finai_edge`) |
| `JWT_SECRET` | the random string from Step 5 |
| `FRONTEND_URL` | **leave empty for now** — you'll fill it in Step 11 |

**❌ Do not type the placeholder text** `<YOUR_MONGODB_URI>`. Type your real value.

`FRONTEND_URL` is empty because your website doesn't exist yet. You'll come back.

### 9c — Fill in the FastAPI service's secrets

Open `finai-edge-fastapi`.

**Already set from `render.yaml` — do not change:** `PYTHON_VERSION=3.11.9`, `ENVIRONMENT=production`,
`LOG_LEVEL=INFO`, and **`OHLCV_BACKEND=mongo`** (the setting from Step 6).

**Add these:**

| Key | Value | Required? |
|---|---|---|
| `MONGODB_URI` | **the identical string** you gave Express | Yes |
| `JWT_SECRET` | **the identical string** you gave Express | Yes |
| `FRONTEND_URL` | leave empty for now | later |
| `GEMINI_API_KEY` | from <https://aistudio.google.com/app/apikey> | optional |
| `GROQ_API_KEY` | from <https://console.groq.com> | optional |
| `FINNHUB_API_KEY` | from <https://finnhub.io/dashboard> | optional |
| `GROWW_API_KEY` + `GROWW_TOTP_SECRET` | from Groww | optional |

> 🔑 **`JWT_SECRET` must be byte-for-byte identical on both services.** Copy and paste — do not retype.
> Watch for a trailing space, which is invisible and will break it.
>
> If they differ, here's exactly what you'll see: **login works perfectly**, the app loads, and then every
> scanner, watchlist, and copilot request fails with 401. That specific pattern almost always means this.
>
> The optional keys are genuinely optional. Without them the app runs and degrades gracefully — the copilot
> returns a clearly-labelled placeholder rather than crashing.

### 9d — Deploy

Click Deploy on both services. First builds take several minutes.

**EXPECTED RESULT:** both services show as live, each with a URL like
`https://finai-edge-backend.onrender.com`.

**📋 Write both URLs down. You need them in Step 10.**

### 9e — Prove they actually work

A green "deployed" badge is not proof. **Express is written to keep running even when the database is
unreachable** — so it can look perfectly healthy while being useless. Check properly.

Open each in a browser:

**1.** `https://<your-express-url>.onrender.com/health`

**EXPECTED:**
```json
{"status":"healthy","timestamp":"2026-08-08T...","db":"connected"}
```

**`"db":"connected"` is the part that matters.** If it says `"disconnected"`, your `MONGODB_URI` is wrong
or Atlas is blocking Render — go back to Step 4c and Step 4d.

**2.** `https://<your-fastapi-url>.onrender.com/health`

**EXPECTED:**
```json
{"status":"healthy","service":"finai-edge-fastapi","version":"2.0.0","providers":{...}}
```

**3.** `https://<your-fastapi-url>.onrender.com/api/v2/status`

**EXPECTED:** includes `"mongodb": {"connected": true}`.

> ⏳ **The first request may take 30+ seconds.** Free-tier services sleep when idle and need to wake up.
> That's a cold start, not a failure. Wait, then retry once before worrying.

**IF THE EXPRESS SERVICE WON'T START:** open its logs. If the last line is
`[FATAL] JWT_SECRET is not set. Refusing to start in production with an insecure default.` — that's the app
protecting you. Add `JWT_SECRET` and restart.

> **PROMPT TO CLAUDE** *(inspect only — Claude cannot access Render)*
> ```
> My Render deployment for [finai-edge-backend / finai-edge-fastapi] is failing. Here is the log output:
>
> [paste the log — redact any secret values first]
>
> Using render.yaml and the actual source in this repo, tell me what's wrong and exactly which setting to
> change. Inspect only — do not modify any files. Remember you cannot access my Render dashboard, so give
> me instructions I can follow myself.
> ```

**STOP HERE if:** either health check fails. The frontend can't work without both backends.

**Then continue to Step 10.**

---

# STEP 10 — Deploy the frontend to Vercel

**🧑 USER MUST DO THIS** — Claude has no Vercel access.

### ⚠️ The one setting people get wrong

This repository has several folders at its top level — `backend`, `frontend`, `docs`. The website is in
**`frontend`**, and Vercel needs telling. **Set Root Directory to `frontend`.** Miss this and the build
fails with a confusing "no framework detected" error.

### 10a — Import the project

1. **Open:** <https://vercel.com>
2. **Sign in with GitHub.**
3. Add a new project and **import** `Poorvansh45/FinTechAi`. Grant repository access if asked.
4. **⚠️ Root Directory: `frontend`.** Look for a root-directory field on the import screen — it may be
   behind an "Edit" link next to the repository name. **This is the critical setting.**
5. **Framework Preset:** Next.js. Vercel usually detects this automatically.
6. **Build settings:** leave them alone. `frontend/vercel.json` already specifies the build command
   (`npm run build`) and the install command (`npm install --legacy-peer-deps`).

   > That `--legacy-peer-deps` flag isn't decoration — some packages in this project disagree about
   > version requirements, and without it npm refuses to install anything. Don't remove it.

### 10b — Add environment variables BEFORE the first build

**This is the step where order genuinely matters.** These values get **compiled into the website** during
the build. Adding them afterwards means rebuilding.

Find the environment variables section on the import screen and add:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | your Express URL from Step 9d — e.g. `https://finai-edge-backend.onrender.com` |
| `NEXT_PUBLIC_FASTAPI_URL` | your FastAPI URL from Step 9d |

**Rules:**
- ✅ Include `https://`
- ❌ **No trailing slash.** `https://x.onrender.com` — not `https://x.onrender.com/`
- ❌ Do not use `localhost` anything

Optional, if you have a Google AI key:

| Key | Value |
|---|---|
| `GOOGLE_API_KEY` | your Gemini key |

> 🔒 Notice this one has **no** `NEXT_PUBLIC_` prefix. That prefix means "send this to every visitor's
> browser". **Never** add it to a secret. Without the prefix, the key stays on the server where it belongs.

### 10c — Deploy

Click Deploy. The build takes a few minutes.

**EXPECTED RESULT:** a success screen with a URL like `https://fin-tech-ai.vercel.app`.

**📋 Write this URL down. You need it in Step 11.**

**IF THE BUILD FAILS:**

| Log says | Meaning | Fix |
|---|---|---|
| `No Next.js version detected` / can't find `package.json` | Root Directory isn't `frontend` | fix it in project settings, redeploy |
| `ERESOLVE unable to resolve dependency tree` | install command lost | confirm it's `npm install --legacy-peer-deps` |
| `Type error: ...` | a real TypeScript error | this is intentional — the build refuses to ship broken types. See the prompt below. |

> **PROMPT TO CLAUDE** *(inspect only — do not modify files unless I explicitly authorise it)*
> ```
> My Vercel build failed. Here is the build log:
>
> [paste the log]
>
> Tell me what's wrong and what I need to change — a Vercel setting, or code. If it's code, show me the
> exact file and line and explain the fix, but do NOT modify anything until I authorise it separately.
> ```

### 10d — Add the app's own URL

Now that you know your Vercel URL:

1. Go to your project's **Settings → Environment Variables**.
2. Add `NEXT_PUBLIC_APP_URL` = your Vercel URL.
3. **Redeploy.** Find the deployments list and redeploy the latest.

> ⚠️ **This is the rule that catches everyone:** changing a `NEXT_PUBLIC_*` variable does **nothing** until
> you redeploy. The old value is baked into the live site. There is no exception. After *any* Vercel
> environment change — redeploy.

**Expected result:** your Vercel URL opens the app.

**It will not fully work yet** — the backends don't know about it. That's Step 11.

**Then continue to Step 11.**

---

# STEP 11 — Introduce the backends to the frontend

**🧑 USER MUST DO THIS**

Browsers enforce a rule called CORS: a page on one website can only call another website if that second
site explicitly says it's allowed. Your backends currently don't know your Vercel URL exists, so the
browser blocks every request.

Fix it by telling them:

1. Go to Render → **`finai-edge-backend`** → environment variables.
2. Set `FRONTEND_URL` = your Vercel URL from Step 10c.
   - ✅ `https://fin-tech-ai.vercel.app`
   - ❌ no trailing slash
3. Save. **Restart the service** (look for a manual deploy or restart action).
4. Repeat **identically** for **`finai-edge-fastapi`**.
5. Restart that one too.

> Environment changes on Render don't apply to the already-running process. Restart both, or you'll spend
> the next twenty minutes debugging a change that did take effect but isn't loaded.

**Expected result:** both services restart and return to healthy.

**Then continue to Step 12.**

---

# STEP 12 — Test everything

**🤝 USER + CLAUDE**

Open your Vercel URL. Press **F12** to open Developer Tools, and keep the **Console** and **Network** tabs
visible — that's where problems announce themselves.

### The essential checks

- [ ] The site loads
- [ ] **Console shows no red errors mentioning CORS**
- [ ] **Network tab shows no requests to `localhost`** — if you see `localhost:8080` or `localhost:8000`,
      your `NEXT_PUBLIC_*` variables didn't reach the build. Go back to Step 10b and redeploy.
- [ ] The login page appears
- [ ] An **owner** account logs in
- [ ] A **beta** account logs in
- [ ] The **demo** account logs in
- [ ] A **wrong password** is rejected with "Invalid email or password"
- [ ] After login, the dashboard loads (no bouncing back to login)
- [ ] LaunchPad screener shows results
- [ ] Alpha Zone screener shows results
- [ ] Other screeners load
- [ ] Watchlists load
- [ ] Copilot responds (or clearly says no AI key is set)
- [ ] **Logout works**, and afterwards protected pages no longer load data

### The security checks — do not skip these

**1. Anonymous users must be locked out.** Open a **private/incognito window** (so you're not logged in)
and visit:

```
https://<your-fastapi-url>.onrender.com/api/scanner/technical
```

**EXPECTED:** `{"detail":"Not authorized — no token provided"}`

**🔴 IF YOU SEE ACTUAL STOCK DATA, STOP.** Your API is open to the world. Tell Claude immediately.

**2. API documentation must be switched off.** Still incognito:

```
https://<your-fastapi-url>.onrender.com/docs
```

**EXPECTED:** a 404 / "Not Found" page. In production these pages aren't merely protected — they aren't
built at all, so there's nothing to probe.

**3. Demo account limits.** Log in as `demo@fintechai.app` and try to **create or edit a watchlist**.

**EXPECTED:** refused with "Editing watchlists is not available on the shared demo account."

**4. Demo rate limit.** As demo, send the copilot **11 messages within 5 minutes**.

**EXPECTED:** the 11th is refused with a message about a rate limit and how long to wait. The limit is per
**account**, not per network address — deliberately, because the demo credential is shared publicly and
arrives from many different places.

> **PROMPT TO CLAUDE** *(inspect only — do not modify files)*
> ```
> I've deployed to production. Here are my results from the smoke test:
>
> [paste which checks passed and which failed, plus any console/network errors]
>
> Compare these against docs/DEPLOYMENT_MASTER_PLAN.md §12 and tell me what's still wrong and how to fix
> it. Pay particular attention to whether anything is publicly accessible that shouldn't be.
> Inspect only — do not modify any files.
> ```

**Then continue to Step 13.**

---

# STEP 13 — Final security review

**🤝 USER + CLAUDE**

> **PROMPT TO CLAUDE** *(inspect only — do not modify files)*
> ```
> Do a post-deployment security audit of this repository. Inspect only — do not modify anything.
>
> Verify from the actual code and confirm each with a file and line:
> 1. No secrets are committed (check git ls-files and .gitignore).
> 2. Both services refuse to start in production without JWT_SECRET.
> 3. FastAPI denies unauthenticated requests by default, and list every public path.
> 4. API docs are unmounted outside development.
> 5. Cookies are httpOnly, secure, and sameSite=none in production.
> 6. CORS does not use a wildcard origin.
> 7. Rate limiting exists and where it applies.
> 8. Demo account restrictions are enforced server-side, not just hidden in the UI.
> 9. Production error responses don't leak exception detail.
>
> For anything you cannot verify from the code, say "NOT VERIFIED" rather than assuming.
> ```

Then your own manual checks:

- [ ] The `JWT_SECRET` exists **only** in the two Render dashboards — nowhere else
- [ ] The database password exists **only** in your password manager and the two Render dashboards
- [ ] Your local `backend\.env` has never been committed (`git status` confirms)
- [ ] Every account password was typed only at the hidden prompt
- [ ] You know whether your GitHub repo is **public or private** — if public, be aware the beta testers'
      email addresses are visible in `backend/scripts/seedUsers.js` (that file contains no secrets, but it
      does list addresses)
- [ ] Nothing you pasted to Claude contained a real secret

**Expected result:** everything checks out, or you have a specific list to fix.

**🎉 You're deployed.**

---

# Troubleshooting

Find your symptom. Each entry explains what the error means before telling you what to change.

---

### ERROR: `401 Unauthorized` on scanners — but login works fine

**MEANING:** Express created your login token successfully, but FastAPI refuses to accept it. The two
services are using different signing secrets, so FastAPI reads Express's token as forged.

**CHECK:**
1. Render → `finai-edge-backend` → `JWT_SECRET`
2. Render → `finai-edge-fastapi` → `JWT_SECRET`
3. Are they **byte-for-byte identical**? Look for a trailing space or a missing character.

**FIX:** copy the value from one service and paste it into the other. **Restart both.**

> **PROMPT TO CLAUDE** *(inspect only)*
> ```
> Login works but every FastAPI call returns 401. Explain the JWT chain in this repo — where the token is
> created, where it's verified, and everything that must match between the two services. Give me a
> checklist. Inspect only.
> ```

---

### ERROR: `401` immediately after login, and the app bounces back to the login page

**MEANING:** the login cookie isn't reaching the server on follow-up requests, so you look logged out the
instant you log in.

**CHECK:**
1. Is `NODE_ENV=production` set on the Express service? Without it, the cookie isn't marked for cross-site
   use and the browser won't send it.
2. Are you visiting the site over **`https://`**?
3. Does `NEXT_PUBLIC_API_URL` start with `https://`?
4. Does `FRONTEND_URL` on Express exactly match your Vercel URL (no trailing slash)?

**FIX:** correct whichever is wrong. Restart Render; redeploy Vercel if you changed a `NEXT_PUBLIC_*` value.

**WHY:** your frontend and backend are on genuinely different domains, so the login cookie is a cross-site
cookie. Browsers only send those when the cookie is marked `secure` — which requires HTTPS everywhere. Mix
in any HTTP and the browser silently drops it.

---

### ERROR: `CORS policy: No 'Access-Control-Allow-Origin' header`

**MEANING:** the browser asked your backend "is `<your-vercel-url>` allowed to call you?" and the backend
didn't say yes.

**CHECK:**
1. Is `FRONTEND_URL` set on **both** Render services?
2. Does it match your Vercel URL **exactly** — `https://`, correct spelling, **no trailing slash**?
3. Did you **restart** both services after setting it?

**FIX:** set it correctly on both, restart both. This is Step 11.

> **PROMPT TO CLAUDE** *(inspect only)*
> ```
> I'm getting CORS errors in production. Here's the console error:
>
> [paste it]
>
> My Vercel URL is [paste it]. Show me the CORS configuration in both backends and tell me exactly what
> FRONTEND_URL must be set to on each. Inspect only.
> ```

---

### ERROR: `503 Authentication unavailable — database not connected`

**MEANING:** FastAPI can't reach MongoDB, so it can't confirm your account is still valid. It refuses
rather than guessing — deliberately, because guessing "probably fine" is how revoked accounts get back in.

**CHECK:** `https://<your-fastapi-url>.onrender.com/api/v2/status` → is `mongodb.connected` false?

**FIX:** see the MongoDB entry below. Authentication recovers by itself once the database does.

---

### ERROR: `/health` shows `"db":"disconnected"`

**MEANING:** the service is running but can't reach your database.

**CHECK, in order:**
1. Is `MONGODB_URI` set on that service?
2. Does it include `/finai_edge` before the `?`
3. Did you replace `<password>` with the real password?
4. Does the password contain `@`, `:`, `/`, or `?` — those break the string format
5. Is Atlas **Network Access** set to `0.0.0.0/0`? (Step 4c)

**FIX:** correct the URI, or fix Network Access. Restart the service.

**Note:** Express keeps serving with a dead database. A green deploy badge proves nothing here — trust
`/health`.

---

### ERROR: Scanner pages load but show zero results

**MEANING:** the app works; the price data isn't there.

**CHECK:** from `C:\path\to\FinTechAi\backend\fastapi_app`:

```bash
python scripts/migrate_ohlcv_to_mongo.py --verify
```

**FIX:** if it reports fewer symbols in Mongo than in the CSV, the migration was incomplete:

```bash
python scripts/migrate_ohlcv_to_mongo.py --resume
```

**❌ Do not trigger a full scan until `--verify` passes.** A scan over zero stocks publishes an empty result
and would wipe whatever cached results still exist.

---

### ERROR: FastAPI logs `OHLCV store is empty: the 'ohlcv' collection has no symbols`

**MEANING:** the server is set to read from MongoDB (correct) but nothing was migrated (Step 7).

**FIX:** run the migration from your laptop (Step 7). This error is a guard doing its job — without it, the
app would silently publish an empty scan.

---

### ERROR: The site loads but everything fails, and Network shows calls to `localhost:8000`

**MEANING:** the frontend was built without your backend URLs, so it fell back to localhost — which on a
visitor's machine means *their* computer.

**CHECK:** Vercel → Settings → Environment Variables → are `NEXT_PUBLIC_API_URL` and
`NEXT_PUBLIC_FASTAPI_URL` set correctly?

**FIX:** set them, then **redeploy**. Setting them alone changes nothing.

**WHY:** these values are compiled into the JavaScript during the build. The live site still contains the
old ones until it's rebuilt. If they were missing at build time, the code's localhost fallback got baked in
instead — which is why the build *succeeded* and only failed in the browser.

---

### ERROR: Vercel build fails — `No Next.js version detected`

**MEANING:** Vercel is looking at the repository root, where there's no website.

**FIX:** Project Settings → General → **Root Directory** → `frontend`. Redeploy.

---

### ERROR: Vercel build fails — `ERESOLVE unable to resolve dependency tree`

**MEANING:** npm hit conflicting version requirements and refused to install.

**FIX:** the install command must be `npm install --legacy-peer-deps`. It's in `frontend/vercel.json`, so
this usually means an override in the Vercel dashboard is fighting it. Clear the override.

---

### ERROR: Vercel build fails — `Type error: ...`

**MEANING:** a genuine TypeScript error. This project deliberately does **not** suppress these — a previous
version did, and shipped real bugs to production as a result.

**FIX:** fix the code. Reproduce locally with `npm run typecheck` in `frontend` (this works on Windows;
`npm run build` does not).

**Meanwhile:** promote your last working deployment in Vercel so the site stays up while you fix it.

---

### ERROR: Render Express won't start — `[FATAL] JWT_SECRET is not set`

**MEANING:** exactly what it says. The app refuses to run in production with an insecure default, which is
correct behaviour.

**FIX:** add `JWT_SECRET` to that service (Step 5 generates one), restart. Then make sure FastAPI has the
**same** value.

---

### ERROR: Render FastAPI build fails during `pip install`

**MEANING:** a Python dependency wouldn't install — usually a Python version mismatch.

**CHECK:** is `PYTHON_VERSION` set to `3.11.9` on that service? It comes from `render.yaml`, but a dashboard
override can replace it.

**FIX:** set it back to `3.11.9`. The numeric libraries this project pins require Python 3.11–3.12.

> **PROMPT TO CLAUDE** *(inspect only)*
> ```
> My Render FastAPI build fails. Here's the log:
>
> [paste it]
>
> Check backend/fastapi_app/requirements.txt and render.yaml and tell me what's incompatible.
> Inspect only — do not modify files.
> ```

---

### ERROR: The first request takes 30+ seconds or times out

**MEANING:** a cold start. Render's free tier puts idle services to sleep.

**FIX:** nothing to fix — wait and retry. If you need it always-on, that's a paid Render plan.

**Also expect:** rate-limit counters reset on wake, and the first few requests after a wake are slower while
caches refill.

---

### ERROR: Scheduled daily scans never seem to run

**MEANING:** the scheduler lives inside the FastAPI process. A sleeping process runs no scheduled jobs.

**FIX:** trigger scans manually from the app, or move to a Render plan that stays awake. Not a
misconfiguration on your part.

---

### ERROR: `POST /api/portfolio/analyze` returns an error in production

**MEANING:** that Express endpoint launches a Python program that needs scientific libraries, and the Node
service on Render only installs JavaScript packages.

**FIX:** nothing needed. No page in the app calls this endpoint — verified by searching the frontend source.
It's documented so it doesn't surprise you.

---

### ERROR: Something else entirely

> **PROMPT TO CLAUDE** *(inspect only — do not modify files unless I authorise it separately)*
> ```
> My deployed app is broken. Here's what I'm seeing:
>
> - What I did: [...]
> - What I expected: [...]
> - What happened instead: [...]
> - Browser console errors: [...]
> - Network tab: [...]
> - Render logs: [...]  (redact secrets first)
>
> Using docs/DEPLOYMENT_MASTER_PLAN.md and the actual repository code, diagnose this. Tell me whether it's
> an environment-variable problem or a code problem, and give me exact steps. Inspect only — do not modify
> anything until I authorise it.
> ```

**Redact secrets before pasting logs.** Replace any connection string or key with `<REDACTED>`.

---

# Every Claude prompt, in one place

Copy-paste ready. Each says what Claude may do.

| Stage | Prompt | Permission |
|---|---|---|
| **Pre-deployment audit** | `Inspect this repository and give me a complete pre-deployment audit: every environment variable actually used, every deployment config file, anything that would break in production. Do not modify anything.` | 🔍 inspect only |
| **Local verification** | `Run npm run typecheck in frontend, npm test in backend, and pytest in backend/fastapi_app. Report pass/fail for each and explain any failures. Do not modify files.` | 🔍 inspect + run tests |
| **Git cleanup** | `Check whether any secret, .env file, or large data file is tracked by git in this repo. Show me git ls-files output for anything suspicious and what .gitignore should cover. Do not modify or delete anything.` | 🔍 inspect only |
| **Environment variable audit** | `List every environment variable this app actually reads, which service needs it, whether it's required, and whether it's a secret. Base it only on the code — not on the docs. Do not modify anything.` | 🔍 inspect only |
| **MongoDB Atlas prep** | `Tell me exactly what my MongoDB connection string must look like for this project — required database name, what both services expect, and common mistakes. Do not ask me for the real string. Inspect only.` | 🔍 inspect only |
| **OHLCV migration verify** | `I ran the OHLCV migration. Output: [paste]. Did it fully succeed? Do the counts look right? Anything to re-run? Inspect only — don't run the migration yourself.` | 🔍 inspect only |
| **Seed verification** | `I ran seedUsers.js. Output: [paste]. Does this match the roster in the script? Which accounts still need a password? Inspect only. Never ask me for a password.` | 🔍 inspect only |
| **Render Express setup** | `Based on render.yaml and backend/, tell me every field and environment variable I need to configure for the finai-edge-backend service on Render. Do not modify anything.` | 🔍 inspect only |
| **Render FastAPI setup** | `Based on render.yaml and backend/fastapi_app/, tell me every field and environment variable I need for the finai-edge-fastapi service. Flag anything that must match the Express service. Do not modify anything.` | 🔍 inspect only |
| **Vercel setup** | `Based on frontend/vercel.json, frontend/package.json and frontend/src/config/env.ts, tell me exactly how to configure the Vercel project — root directory, build settings, and every environment variable. Do not modify anything.` | 🔍 inspect only |
| **CORS verification** | `Show me the CORS configuration in both backends and tell me exactly what FRONTEND_URL must be set to on each for my Vercel URL [paste]. Do not modify anything.` | 🔍 inspect only |
| **Authentication verification** | `Walk me through the full authentication chain in this repo — where the JWT is created, stored, retrieved and verified — and list every environment variable that must match between services. Do not modify anything.` | 🔍 inspect only |
| **Production smoke test** | `Give me a production smoke-test checklist based on the actual routes and role restrictions in this repo, including the exact URLs to hit and what each should return. Do not modify anything.` | 🔍 inspect only |
| **Troubleshooting** | `My deployed app is broken. [describe symptoms, paste redacted logs]. Diagnose using the real repository code. Tell me if it's environment or code. Inspect only until I authorise a change.` | 🔍 inspect only |
| **Rollback** | `Something broke in production. Explain my rollback options for [Vercel / Render / the OHLCV backend / an env var], and which are environment changes versus code changes. Do not modify anything.` | 🔍 inspect only |
| **Post-deployment security audit** | `Do a security audit of this repository against docs/DEPLOYMENT_MASTER_PLAN.md §14. Verify each item from the actual code with file and line. Say NOT VERIFIED for anything you can't confirm. Do not modify anything.` | 🔍 inspect only |

---

# Command reference

Every command in this guide, with its required directory. **All paths assume `C:\path\to\FinTechAi` — replace
with your real path.**

| What | Directory | Command |
|---|---|---|
| Check tools | anywhere | `node --version` |
| Check tools | anywhere | `python --version` |
| Where am I | anywhere | `cd` |
| Typecheck frontend | `\frontend` | `npm run typecheck` |
| Test Express | `\backend` | `npm test` |
| Test FastAPI | `\backend\fastapi_app` | `python -m pytest tests/ -q` |
| Check for secrets | repo root | `git status` |
| List tracked env files | repo root | `git ls-files \| findstr /I ".env"` |
| Current branch | repo root | `git branch --show-current` |
| Push | repo root | `git push origin akarsh-feature` |
| Generate JWT_SECRET | anywhere | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| Migrate 50 symbols | `\backend\fastapi_app` | `python scripts/migrate_ohlcv_to_mongo.py --limit 50` |
| Migrate all | `\backend\fastapi_app` | `python scripts/migrate_ohlcv_to_mongo.py` |
| Resume migration | `\backend\fastapi_app` | `python scripts/migrate_ohlcv_to_mongo.py --resume` |
| Verify migration | `\backend\fastapi_app` | `python scripts/migrate_ohlcv_to_mongo.py --verify` |
| Preview seeding | `\backend` | `node scripts/seedUsers.js --dry-run` |
| Apply seeding | `\backend` | `node scripts/seedUsers.js` |
| Set a password | `\backend` | `node scripts/setPassword.js someone@example.com` |

**🔴 Directory mistakes that fail silently:**

- Running `seedUsers.js` from the repo root → connects to your **local** database and reports success.
  Always `cd backend` first, and read the `[seed] connected to …` line.
- Running the migration from the repo root → misses your Atlas connection string and targets localhost.
  Always `cd backend\fastapi_app` first.

---

# Reminders worth repeating

1. **`JWT_SECRET` must be identical on both Render services.** Copy-paste, never retype.
2. **Any `NEXT_PUBLIC_*` change on Vercel requires a redeploy.** Always. No exceptions.
3. **Never delete `backend\data\Stock_Data.csv`.** It's your rollback.
4. **`cd` to the right folder before running scripts.** The failures are silent.
5. **Passwords go only at the hidden `setPassword.js` prompt** — never in a file, a chat, or a command
   argument.
6. **Include `/finai_edge` in your MongoDB connection string.**
7. **A green deploy badge isn't proof.** Check `/health`.
8. **Cold starts take 30+ seconds on the free tier.** Wait before diagnosing.
9. **Claude cannot access your dashboards.** Every click is yours.
10. **Redact secrets before pasting logs into a chat.**
