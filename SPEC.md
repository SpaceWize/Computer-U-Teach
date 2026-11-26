# SPEC: canuteach.me overhaul

Written from the /ask interview on 2026-11-26. Reference research and mockups are added later by /search.

## 1. Overview

- **Site type:** Redesign of an existing small-business site, same domain (canuteach.me).
- **Purpose:** Get visitors to book a computer repair. HTML classes are the secondary offer.
- **Audience:** Repair customers first, HTML class learners second.
- **Main action (primary CTA):** Book a repair.
- **Secondary action:** Sign up for an HTML class.
- **Deadline:** TODO (owner: user).

## 2. Direction

- **User's own description:** "I need to do a bit of some overhaul on the canuteach.me website. They need it to be in a lego theme, and we need to focus on the repair services and the main CTA, and then HTML classes as second. Reference the original site. We will make images later."
- **Visual direction:** Full LEGO brick world. Everything looks built from bricks: studded buttons, brick-shaped cards, bright primary toy colors throughout.
- **Fonts:** "Bold instruction-booklet": strong, tidy headings like a building-instructions booklet, with neat, very legible body text.
  - Heading: `Archivo Black`
  - Body: `Archivo`
- **Key elements (most important):** Repair services, LEGO visuals (brick shapes, studs, image slots).
- **Reference screenshots:** None provided (see Open items).
- **Reference links (as written):** `canuteach.me` (the original site; the user asked that it be referenced).
- **Images:** To be made later by the user. Build with clearly sized, labelled image slots.

### Reference research (added by /search, 2026-11-26)

Where this block disagrees with the rest of the spec, this block is newer. It supersedes: "No screenshots provided" (three were given), the proposed colour hex values in section 4, the "Motion level: TODO" line in section 5, and the open items for screenshots, motion doodles, and palette in section 8.

**Reference images (supplied by the user in chat, not saved to the repo)**

| # | What is visible | What the user wants from it |
|---|-----------------|-----------------------------|
| 1 | Doodle. Rows of flat bricks in red, blue, yellow, and green on white, each with three rounded studs on top, rows loosely stacking toward a solid bottom row. | The brick shape and the wall building up. |
| 2 | Photo. "LET'S PLAY" spelled out in multicoloured bricks on a green studded baseplate. | Hero text and buttons should appear like this. |
| 3 | Doodle. A full running-bond brick wall filling the screen, with two cyan panels in the centre: "Hero Here! / Jump to buttons" and "some info, CTA". | The hero layout once the wall is full. |

**User's direction (verbatim):** "i think the hero should be where 3d lego bricks load in, and they fall onto eachother creating a wall, and when its full the hero (image three) text and buttons appear like the second image. then the rest of the page looks like a lego manual. the images will be legofied. if this is too heavy for a phone, then the fallback for the specific phone is svg. three.js is more than welcome."

**Style summary**

- Colours sampled from the doodles: red `#ed1c24`, blue `#3f48cc`, yellow `#fff200`, green `#0ed145`, plate cyan `#00a8f3`, ink `#1b1b1b`, manual page `#d5e6f3`.
- Hero: bricks fall and stack into a wall that fills the screen; then two cyan studded plates appear, the first with a headline built from bricks and jump buttons, the second with a blurb and the main CTA.
- Rest of the page: building-instructions manual. Numbered steps, a yellow parts box, page numbers, dashed slots for legofied images.

**Original site (canuteach.me), studied for content**

- Home is education-led ("Are You Ready For Study", "Book a free class"); repair is a short block at the bottom. The overhaul reverses that order.
- The Repair page has no content beyond contact details, so there is no services or price list to reword.
- Three testimonials exist; one is about a repair (Arash Khodadadi) and is used in the mockup.
- All booking buttons currently link to `signup-u-teach.as.me`.
- Current URLs: `/`, `/repair-shop/`, `/contact-us/`, `/blogs/`, `/course/`.
- The header shows phone `+1(604)-255-7434` and the footer shows `+1(604)-225-7434`. One is wrong.

**Fit checklist**

| Line | From the spec |
|------|---------------|
| Purpose and main action | Book a repair |
| Audience | Repair customers first, learners second |
| Visual direction | Full LEGO brick world |
| Font look | Bold instruction-booklet: Archivo Black headings, Archivo body |
| Key elements | Repair services, LEGO visuals |
| Layout feel | Stacked brick sections; now a brick-wall hero, then manual pages |
| Motion level | Now set by the user's direction: heavy hero build, light elsewhere. Reduced-motion fallback required. |
| Copy tone and density | Friendly and plain; balanced |
| Devices and performance | Equal priority; must run well on a cheap Android phone (SVG wall fallback) |
| Build method | HTML, CSS, JavaScript; three.js allowed by the user for the hero |
| Accessibility target | WCAG 2.2 AA |

**Effects considered**

| Effect | Source | Fit | Outcome |
|--------|--------|-----|---------|
| Toast Overshoot | kinetics.colorion.co/effects/toast-overshoot/ | Fits | Used: its settle curve on plates, headline cells, and SVG rows |
| Dot Pattern | magicui.design/docs/components/dot-pattern | Fits | Used: rewritten as plain CSS studs on the plates; glow option dropped |
| Button "hot-catfish-48" by adamgiebl | uiverse.io/adamgiebl/hot-catfish-48 | Fits | Used: tilt-and-press CTA; blue gradient and glow shadow removed |
| Deep-Type (3D Extruded Text) | text-effects.colorion.co/effects/3d-text-effect/ | Partly fits | Not used: the brick-built headline from image 2 replaced it |
| Keycap | text-effects.colorion.co/effects/keyboard-keycap-text-animation/ | Partly fits | Not used: constant loop is heavy on weak phones |
| Kaboom (Text Slam) | text-effects.colorion.co/effects/slam-text-animation/ | Conflicts | Dropped: shake and blur conflict with the cheap-phone requirement |
| Button "big-ape-36" by adamgiebl | uiverse.io/adamgiebl/big-ape-36 | Partly fits | Not used: slanted text is hard to read |

**Picks**

The user reviewed eight options in a review file, then set their own direction with the three images above. The final look is a blend:

- Hero: an original three.js falling-brick wall (images 1 and 3), an original brick-built headline (image 2), Dot Pattern studs, the Toast Overshoot settle, and the hot-catfish-48 press on the CTA.
- Feature: an original manual layout (user's note), plus the hot-catfish-48 press on the CTA.

**Hero behaviour as built**

- 3D mode: instanced bricks fall and stack bottom row first, about 5 seconds, then the render loop stops. A "Skip animation" button is shown until the wall is built.
- SVG mode: the same wall as flat SVG rows that drop in. Chosen when WebGL is missing, device memory is 2 GB or less, or there are 2 or fewer processor cores. These thresholds are untested guesses (see below).
- Reduced motion: the finished wall and hero show immediately.
- No JavaScript: a static brick-pattern background with the hero visible.
- `?wall=svg` or `?wall=3d` forces a mode.

**Approval and files**

- Preview approved by the user on 2026-11-26 ("Build final files").
- `mockups/preview.html`: approved preview, with review-only Replay and mode buttons.
- `mockups/hero.html`: final hero mockup.
- `mockups/feature.html`: final repair services mockup.
- The mockups need a local server (scripts do not run when the file is opened in the app's preview pane): `.claude/launch.json` serves `mockups/` on port 8137.

**Services and prices (from the current booking page, signup-u-teach.as.me, read 2026-11-26)**

| Group on booking page | Appointment | Length | Price |
|-----------------------|-------------|--------|-------|
| A+ First Tech Repair | Free Computer Repair Booking or Consult | 30 minutes | Free |
| A+ First Tech Repair | 1 Hour REPAIR 25% off! | 1 hour | CA$50.00 |
| A+ First Tech Repair | Guaranteed Fix: Computer Repair or Consult ONLINE ONLY | 1 hour | CA$65.00 |
| A+ First Virtual Elder Lessons | ONLINE LESSON for ELDERS | 1 hour | CA$65.00 |
| U-Teach Lessons | U-Teach Computer Lessons | 50 minutes | CA$65.00 |
| U-Teach Lessons | Website starter package (10 hours total work, 75 min initial consult) | 1 hour 15 minutes | CA$450.00 |

- These resolve the "Services and prices list" open item in section 8, pending the owner's confirmation that they are current.
- No appointment is called an HTML class. The closest are U-Teach Computer Lessons and the Website starter package.
- `/course/` on the current site shows "No products were found", and `/blogs/` returns a 404.

**Reviews (from the current home page)**

Three testimonials exist, and `mockups/feature.html` now shows all three in full: Arash Khodadadi (laptop SSD upgrade, repair), Caron Smed (senior lessons), Jennifer Rowe (kids computer camp). Only one is about repair. A web search found no other public reviews for the business.

**Feature mockup, second pass**

`mockups/feature.html` now has, in order: the three build steps, "Pick your repair" (three repair services with prices and booking buttons), "What customers say" (three reviews), the Book a repair CTA, and a second manual page, "Classes and lessons" (three lesson offerings with prices). Booking buttons link to the current booking page.

**New open items from this pass**

| Item | Owner |
|------|-------|
| Which phone number is correct: 604-255-7434 or 604-225-7434. | User |
| Confirm "We fix it" as the headline, or supply another. A brick-built headline needs a glyph drawn for each letter used. | User |
| Whether Book a repair keeps linking to `signup-u-teach.as.me` or uses a new on-site form. | User |
| Confirm the booking-page services and prices are current, and whether the "25% off" on the one-hour repair is permanent. | User |
| The HTML class is not listed on the booking page yet (confirmed by the user, 2026-11-26). Needed: length, price, what it covers, who it is for, and a booking-page appointment to link to. The mockup shows a placeholder card. | User |
| More repair reviews if any exist elsewhere (for example a Google Business profile); only one of the three is about repair. | User |
| Tune the weak-phone thresholds on a real cheap Android phone. | Builder |
| Host three.js locally instead of loading it from a CDN. | Builder |
| Contrast-check the doodle palette against WCAG 2.2 AA (white text on the green and red in particular). | Builder |
| Save the three reference images into the repo if they should be kept. | User |

## 3. Sitemap and pages

Pages chosen: **Home**, **Book / contact**. Repair services and HTML classes live as sections on Home, not separate pages.

**Redirects:** TODO. List the current canuteach.me URLs and map any that disappear to Home or Book / contact (owner: builder, from the original site).

### Home

- **Purpose:** Present repair services and push visitors to book a repair; introduce HTML classes second.
- **H1:** TODO (reword from the original site).
- **Meta description:** TODO (reword from the original site).
- **Section order:**
  1. Hero with the Book a repair CTA
  2. Repair services (services and prices list, supplied by user)
  3. Reviews / testimonials (supplied by user)
  4. HTML classes, with a class sign-up CTA
  5. Closing Book a repair CTA
  6. Footer (contact details, privacy policy, terms)
- **Main CTA:** Book a repair.

### Book / contact

- **Purpose:** Take repair bookings and HTML class sign-ups; give visitors a way to get in touch.
- **H1:** TODO.
- **Meta description:** TODO.
- **Section order:**
  1. Repair booking form
  2. HTML class sign-up form
  3. Contact details (TODO: phone, email, address, hours from the user or the original site)
- **Main CTA:** Submit the repair booking.

### Copy

- **Source:** Take the text from the current canuteach.me and reword whatever is being kept. Do not invent facts.
- **Tone:** Friendly and plain. Warm, simple language, no tech jargon.
- **Density:** Balanced: headlines plus short paragraphs.

## 4. Design tokens

Colors are proposed starting values for a bright primary brick palette. The user has not confirmed them, and they must be contrast-checked against WCAG 2.2 AA before use.

```css
:root {
  /* Colors (TODO: confirm with user) */
  --color-red: #d01012;
  --color-yellow: #ffd500;
  --color-blue: #0055bf;
  --color-green: #00852b;
  --color-ink: #1b1b1b;
  --color-paper: #ffffff;
  --color-baseplate: #f2f2ee;

  /* Fonts */
  --font-heading: "Archivo Black", "Arial Black", Impact, sans-serif;
  --font-body: "Archivo", Arial, Helvetica, sans-serif;

  /* Spacing, on an 8px stud unit */
  --stud: 8px;
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-6: 48px;
  --space-8: 64px;

  /* Radii */
  --radius-brick: 6px;
  --radius-stud: 50%;

  /* Breakpoints (reference values; use in media queries) */
  --bp-sm: 480px;
  --bp-md: 768px;
  --bp-lg: 1100px;
}
```

## 5. Components and motion

- **Layout feel:** Stacked brick sections. Each section is a big colored brick layer stacked down the page, snapping onto the one above.
- **Components:** Studded CTA button, brick section, brick card (service, review, class), studded divider between sections, brick-styled form fields, image slot placeholder, header, footer.
- **Motion level:** TODO. The user will supply the motion idea as doodles (see Open items). Nothing is specified until they arrive.
- **Build method:** HTML, CSS, canvas, and JavaScript. All motion is built in code.
- **Reduced motion:** Every animation needs a `prefers-reduced-motion` fallback that shows the final state with no movement.
- **Devices:** Phones and desktops have equal priority, and the site must run well on a cheap Android phone. Keep animation light, and scripts and images small.

## 6. Features, data, and accessibility

- **Features:**
  - Repair booking form
  - HTML class sign-up form
- **Accounts:** None.
- **Payments:** None.
- **Data collected:** Whatever the two forms ask for. TODO: exact fields (likely name, contact details, device, problem description; class of interest). Collect the minimum needed.
- **Form delivery:** TODO. Where submissions go (email address or service) depends on hosting.
- **Credibility content (from the user):** Reviews or testimonials; prices or services list. Use `TODO:` placeholders until supplied.
- **Accessibility target:** WCAG 2.2 AA.
- **Hosting and tech:** Not sure (see Open items).

## 7. Security and launch

### Must-have (confirmed by user)

| # | Item | Status |
|---|------|--------|
| S8 | Errors don't leak stack traces | Not started |
| S11 | A 404 and a 500 page that don't look broken | Not started |
| S12 | Works on a cheap Android phone | Not started |
| S14 | Meta tags and an OG image so links look right | Not started |
| S15 | Privacy policy and terms | Not started |
| S18 | Form emails don't land in spam (SPF, DKIM, DMARC) | Not started |
| S19 | A way for users to contact you | Not started |
| SEO1 | Sitemap generated | Not started |
| SEO2 | Sitemap submitted to Google Search Console | Not started |
| SEO3 | robots.txt doesn't block Googlebot | Not started |
| SEO4 | No stray noindex tags on pages that should rank | Not started |

**SEO2 steps (manual):** Sign in to Google Search Console, select the canuteach.me property (verify it if needed), open Sitemaps, enter the sitemap URL, and submit.

### Security appendix

- [ ] 1. Hide every API key. *Suggested: applies if the forms use a third-party service with a key.*
- [ ] 2. Rotate any key that was ever committed. *Not needed: no keys in the project yet.*
- [ ] 3. Rate limiting. *Suggested: stops spam floods on the two forms.*
- [ ] 4. Check auth on every route. *Not needed: no accounts.*
- [ ] 5. Lock down database rules. *Not needed: no database planned.*
- [ ] 6. Validate every input on the server. *Suggested: the forms accept free text.*
- [ ] 7. Spending cap on the AI or API provider. *Not needed: no paid API.*
- [ ] 8. Errors don't leak stack traces. **Must-have**
- [ ] 9. Error tracking. *Suggested: lets you know if a booking form fails.*
- [ ] 10. Back up the database and test a restore. *Not needed: no database planned.*
- [ ] 11. A 404 and a 500 page that don't look broken. **Must-have**
- [ ] 12. Works on a cheap Android phone. **Must-have**
- [ ] 13. Nothing takes more than 3 seconds to load. *Suggested: supports the cheap-Android requirement.*
- [ ] 14. Meta tags and an OG image. **Must-have**
- [ ] 15. Privacy policy and terms. **Must-have**
- [ ] 16. Analytics that show where people drop off. *Suggested: no analytics requested.*
- [ ] 17. Test signup, payment, and password reset end to end. *Not needed: no accounts or payments. Do test both forms end to end.*
- [ ] 18. Emails don't land in spam (SPF, DKIM, DMARC). **Must-have**
- [ ] 19. A way for users to contact you. **Must-have**
- [ ] 20. A written rollback plan for launch day. *Suggested: this replaces a live site, so keep a copy of the current one.*

## 8. Open items

| Item | Owner |
|------|-------|
| No screenshots provided. Style currently rests on the interview answers and the original site. | User |
| Motion: user will supply the idea as doodles. Motion level is unspecified until then. | User |
| Hosting and tech: "Not sure". Needed before form delivery can be decided. | User |
| Images: to be made later. Slots only for now. | User |
| Deadline. | User |
| Services and prices list. | User |
| Reviews / testimonials (real ones only). | User |
| Contact details: phone, email, address, hours. | User |
| Booking form and class sign-up form fields, and where submissions are sent. | User |
| Privacy policy and terms text. | User |
| Color palette hex values: proposed, not confirmed. | User |
| Trademark check: LEGO is a registered trademark. Decide how far the brick look goes, and avoid the LEGO logo, name, and minifigures as branding. | User |
| Pull the current copy and URL list from canuteach.me; reword what is kept; write H1s and meta descriptions. | Builder (/search) |
| Redirect map for any URLs that go away. | Builder |
| Contrast-check the palette against WCAG 2.2 AA. | Builder |
