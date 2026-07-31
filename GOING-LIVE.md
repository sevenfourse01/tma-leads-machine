# Putting this site on themissionautomation.com

This replaces the Framer site. After this, the whole site — the sales page, the demo, the library,
contact — is one folder in this repo, hosted free on GitHub Pages, and it updates whenever the repo
is pushed to. No Framer subscription needed, nothing to republish.

**Do the steps in order.** Steps 1 and 2 change nothing that visitors see. Step 3 is the moment the
site actually swaps over.

---

## Step 1 — Turn on the custom domain in GitHub

1. Go to **github.com/sevenfourse01/tma-leads-machine**
2. Click **Settings** (the tab along the top, on the right)
3. In the left sidebar click **Pages**
4. Find the box marked **Custom domain**
5. Type exactly: `themissionautomation.com`
6. Click **Save**

It will show a red or amber warning about DNS. **That is expected.** The warning goes away after
step 2. Leave the page open.

---

## Step 2 — Point the domain at GitHub (this is the only fiddly bit)

1. Go to **namecheap.com** and sign in
2. Left sidebar: **Domain List**
3. Find `themissionautomation.com` and click the **Manage** button next to it
4. Click the **Advanced DNS** tab along the top

You'll see a list of records. Two of them currently send your website to Framer:

| Type | Host | Value |
|---|---|---|
| A Record | @ | `31.43.160.6` |
| A Record | @ | `31.43.161.6` |

5. **Delete both of those** using the bin/trash icon on the right of each row.
   (If there's also an `ALIAS` or `CNAME` record on Host `@`, delete that too.)

6. Now click **ADD NEW RECORD** four times, and make four A Records that look exactly like this:

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | @ | `185.199.108.153` | Automatic |
| A Record | @ | `185.199.109.153` | Automatic |
| A Record | @ | `185.199.110.153` | Automatic |
| A Record | @ | `185.199.111.153` | Automatic |

7. Find the existing record for Host `www` and **change its value** to `sevenfourse01.github.io`
   (if it's an A Record, delete it and add a **CNAME Record**, Host `www`, Value
   `sevenfourse01.github.io`)

8. Click the green **✓ SAVE ALL CHANGES** button

---

## Step 3 — Wait, then turn on the padlock

DNS takes between 10 minutes and an hour to spread. Go and do something else.

When you come back:

1. Visit **https://themissionautomation.com** — you should see the new site (black page, big
   "Put data in. Get leads out.")
2. Go back to **GitHub → Settings → Pages**
3. The DNS warning should now be a green tick
4. Tick the **Enforce HTTPS** checkbox

If Enforce HTTPS is greyed out, GitHub is still issuing the security certificate. Wait 30 minutes
and tick it then. **Don't skip it** — without it, browsers show "Not secure".

---

## Step 4 — Tidy up Framer (optional, do it later)

Once you're happy the new site is live, you can cancel the Framer subscription. Don't do it on day
one; keep it a week in case you want to look something up. Cancelling Framer does **not** affect
your domain — the domain is at Namecheap, and Framer was only ever renting it a place to point.

---

## What you get

| Address | What's there |
|---|---|
| `themissionautomation.com` | The sales page |
| `themissionautomation.com/demo/` | The demo |
| `themissionautomation.com/demo/resources.html` | Everything we build, all 22 systems |
| `themissionautomation.com/contact/` | Email, phone, and a route into the demo |
| `themissionautomation.com/systems` | Redirects to the library, so old links still work |
| `themissionautomation.com/about` | Redirects to the homepage, so old links still work |

## How to change the site from now on

Tell Claude what you want changed. It edits the files, pushes, and the live site updates itself in
about a minute. There's no "publish" button to press and no separate staging step.

## Two things still not done

- **There is no booking calendar.** Every "Book a call" points at `/contact/`, which has the email
  and phone. If you set up a Cal.com link, one line changes in `app.js` and `demo/shared.js` and
  every button on the site follows.
- **The old Framer site's links were broken** and those breakages don't carry over, but worth
  knowing what they were: the main "Book a Call" pointed at `framer.link/kanishkdubey`, the
  template author's calendar, and the social icons pointed at the bare platform homepages. If you
  want social links on the new site, send the real profile URLs.
