# Putting the demo on themissionautomation.com (Framer)

The demo is hosted on this repo's GitHub Pages site and embedded into Framer with an iframe.
Framer can't run this code natively, so it stays here and Framer displays it. That also means you
update the demo by pushing to this repo — Framer needs no republishing for the demo to change.

## The two URLs

| What | URL |
|---|---|
| The demo | `https://sevenfourse01.github.io/tma-leads-machine/demo/full.html` |
| The library (every system we build) | `https://sevenfourse01.github.io/tma-leads-machine/demo/resources.html` |

Add `?embed=1` when embedding. That strips the nav, the footer and the background wash, so it sits
inside your Framer page instead of looking like a second website nailed to the middle of one.

Add `&book=<your booking page>` so "Book a call" leaves the iframe and lands on **your** page
rather than loading this site inside your layout. Point it wherever you take bookings —
`https://themissionautomation.com/contact`, or a Cal/Calendly link.

## Replacing the Systems section

1. Open the Framer project → the **Systems** page (`/systems`).
2. Select the section holding the three system cards ("AI Lead Gen & Outreach", "AI Onboarding &
   CRM", and the third). Keep the "Unlock AI Insights with Us" heading above it if you want; the
   demo reads fine underneath it.
3. Delete that card row, or hide it while you compare the two.
4. From the Framer toolbar: **Insert → Utility → Embed**.
5. Set the embed type to **URL** and paste:

   ```
   https://sevenfourse01.github.io/tma-leads-machine/demo/full.html?embed=1&book=https://themissionautomation.com/contact
   ```

6. Set the frame's width to **Fill**, and height to a **fixed 2400px**. The demo grows as the
   blueprint renders, and Framer embeds don't auto-size. 2400 fits the longest blueprint without
   an inner scrollbar; if you'd rather it was tighter, 1600 is fine and the iframe scrolls.
7. On mobile, set the same embed to Fill width and height **3200px** — the cards stack, so it gets
   taller rather than wider.

### If you want the iframe to size itself

The page posts its height to the parent whenever it changes:

```js
window.addEventListener("message", (e) => {
  if (e.data && e.data.tmaEmbedHeight) {
    document.querySelector("#tma-demo iframe").style.height = e.data.tmaEmbedHeight + "px";
  }
});
```

That needs a Framer **Code Component** or a custom `<script>` in Page Settings → Custom Code, with
the embed given the id `tma-demo`. The fixed height in step 6 works without any of this; only do
this if the dead space annoys you.

## Adding the library as its own page

Worth doing: the demo names systems and links into the library, and the library is a natural
`/systems` replacement in its own right.

1. New Framer page, e.g. `/systems/what-we-build`.
2. Insert → Embed → URL:

   ```
   https://sevenfourse01.github.io/tma-leads-machine/demo/resources.html?embed=1&book=https://themissionautomation.com/contact
   ```

3. Height **3200px** desktop. All 22 systems render at once, so it's a long page.

Deep links work: `resources.html?embed=1#SPEED` opens on that system's stage with the card
highlighted. That's what the demo's "What this involves →" links use.

## What the visitor sees

Answer a few questions → a blueprint naming the systems we'd build, in order, each saying what it
needs from you → "What this involves →" into the library → the six things the page can't know →
book the call. Nothing is priced anywhere, matching the site.

## Before you publish

- `CONTACT_EMAIL` in `demo/shared.js` is still unconfirmed.
- Check the booking URL you pass in `&book=` actually resolves.
- Framer serves over https, and so does GitHub Pages, so there's no mixed-content problem.
