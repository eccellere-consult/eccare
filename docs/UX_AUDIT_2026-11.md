# EC experience audit: elder, family caregiver and service provider

**Date:** 28 November 2026 · **Scope:** web app (`eccellere-consult/eccare`, `main` at `125560e`) · **Lens:** low digital literacy, low cognitive load, frictionless use

## 1. Executive summary

**EC has the right features, but it asks each user to choose among too many of them.** The elder home screen offers about 15–20 tappable things, the community hub 19 tiles, and the health page 13 sections. A design target for a low-literacy elder is about 6 choices per screen. The biggest gains come from removing, merging and reordering, not from building more.

Four findings matter most:

1. **Safety signals can mislead.** The family dashboard shows a green "All clear" when its data fails to load, and when no medicine has been taken. An SOS stays red after someone responds, because no screen ever marks it resolved.
2. **The most important actions are not the easiest to reach.** SOS is the sixth block on the elder home and is not in the fixed navigation. The caregiver's view of their parent sits below the caregiver's own emergency card.
3. **Shops are not told about new orders.** No push, no badge and no refresh: a shopkeeper learns of an order only by opening the Orders page.
4. **The same thing exists in several places under different names.** There are two kinds of contacts, three SOS paths, four money concepts, three reminder surfaces and two paid-promotion systems.

**Recommendation:** run three short waves. Wave 1 fixes the safety and order-notification gaps (days). Wave 2 simplifies navigation and home screens for all three roles (two to three weeks). Wave 3 merges duplicated features and completes local-language and voice coverage.

### How to read this audit

- **Method:** a structured read of the code for all three roles, with file and line evidence. The four safety and order findings above were re-checked directly.
- **Limits:** nothing was tested on a phone or with real elders, shopkeepers or caregivers. Findings marked *inferred* were reasoned from the code, not observed. Tap counts are from the code paths.
- **Not covered:** admin screens, the separate Android companion app, and page-load speed.

## 2. Scorecard

| Dimension | Elder | Family caregiver | Service provider |
|---|---|---|---|
| Choices per screen (target ≤ 6) | Poor: 15–20 on home, 19 tiles in community | Fair: 11 nav items, 4 visible on phone | Fair: 7 blocks on overview, 9 actions on catalogue |
| Critical action reach | Poor: SOS is 2 taps plus a scroll | Poor: parent status below the fold | Poor: new orders are silent |
| Typing needed | Fair: login and profile need typing | Poor: invite has 6 fields, medicine times are free text | Fair: photo helper removes most typing |
| Touch targets (≥ 48 px) | Mixed: main buttons good, chips and pop-ups small | Mixed: many 36 px buttons | Poor: 36 px used for every order action |
| Plain language | Mixed: several names for one thing | Mixed: jargon such as "Emergency Contact Matrix" | Poor: raw status words and raw JSON shown |
| Local language and voice | Mixed: 6 languages, but key cards English-only; Arya English-only | Not assessed in depth | English-only |
| Error handling | Poor: silent failures, raw server text | Poor: false "All clear" | Poor: failed actions show nothing |

## 3. Fix first: safety and trust

These are defects, not design preferences. Each is small to fix.

| # | Finding | Evidence | Fix |
|---|---|---|---|
| S1 | Family card shows "All clear" when the data request fails | `app/family/family-dashboard-elder-card.tsx:53-57, 104-111` | Show "Could not check. Tap to retry." |
| S2 | "All clear" is based on SOS only; 0 of 5 doses taken still shows green | same file, `:59-66` | Combine SOS, missed doses and mood into one status |
| S3 | An SOS never becomes resolved in any screen, so the card stays red for 24 hours | resolve exists only in `app/api/v1/emergency/sos/[id]/route.ts:7` | Treat "I'm on it" as handled; add "Mark resolved" |
| S4 | Four family screens load only one parent; a second parent cannot be reached | `findFirst` in `app/family/contacts/page.tsx:17`, `orders/page.tsx:16`, `payments/page.tsx:19`, `app/services/page.tsx:19` | Add one elder switcher used by every screen |
| S5 | Shops get no alert for a new order | no push call in `app/api/v1/orders/route.ts` or `orders/[id]/verify-payment/route.ts`; orders page loads once (`app/provider/orders/page.tsx:185-187`) | Push on new order, 30-second refresh, count badge |
| S6 | Failed actions show nothing: confirm order, cash received, stock toggle, delete, invite response | `app/provider/orders/page.tsx:189-211`, `app/provider/catalog/page.tsx:255-268`, `app/elder/elder-home-client.tsx:49-63` | Add a plain message on failure |
| S7 | A family invite sends no message to the elder | `app/api/v1/family/invite/route.ts:117-131` | Send a WhatsApp or share link; add resend and cancel |
| S8 | Caregivers with view-only access still see Add, Edit and Delete (*inferred*) | `app/family/health/[elderId]/page.tsx` never reads `canManageMeds` | Hide manage controls for view-only |
| S9 | Voice SOS through Arya only records the event and opens no WhatsApp chat | `components/voice-assistant.tsx:225-233` | Use the same path as the SOS button |

## 4. Elder experience

**Core problem: too many choices, and help is not always one tap away.**

### What the elder sees

- **Navigation:** 9 items, of which the phone bar shows 4 (Home, Contacts, Health, Community). The other 5, plus Log out, sit behind an icon-only menu button (`components/app-shell.tsx:70-78, 311-317, 389`).
- **Home:** 7 blocks in this order: greeting, companion card with 5 mood chips, daily quote, family invites, Call Family, Emergency, prescriptions (`app/elder/elder-home-client.tsx:67-156`).
- **Health:** 13 sections on one page.
- **Community hub:** 19 tiles plus a panic button. **Services:** 10 tiles plus 13 outside links.

### Taps to the six key jobs

| Job | Taps today | Target |
|---|---|---|
| SOS | 2 plus a scroll, then a browser confirm box | 1, from every screen |
| Call family | 2 | 1–2 |
| Take medicine | 1–2 | 1 |
| Talk to Arya | 1 | 1 |
| Order something | 6 or more (*inferred* past tap 3) | 3 |
| See notices | 2, and only for community members | 1–2 |

### Friction

- **Browser confirm boxes** on SOS, ambulance and police (`components/emergency-actions.tsx:86, 116, 122`). These are small, look like errors, and differ by phone.
- **Small targets** on the things elders tap most: mood chips, medicine "Taken" and "Snooze", close buttons (36 px), WhatsApp chips, and invite Accept and Decline (`components/companion-card.tsx:102`, `components/medicine-alerts.tsx:177-193`).
- **Icon-only actions:** Call and Delete on a contact, and the menu button (`app/elder/contacts/contacts-client.tsx:96-109`).
- **Language gaps:** six languages exist, but the companion card, medicine pop-ups, health essentials, prescription upload and the Services page are English-only. The Services pages drop the language switch entirely (`app/services/layout.tsx:13`).
- **Arya is English-only** (`lib/speech.ts:4, 56`) and disappears where the phone cannot recognise speech, with no typed or tile fallback.
- **Caregiver wording shown to elders:** "Do they already have any of these?" (`components/health-essentials.tsx:451`).

### Simplify

1. **Fix a Help button on every elder screen.** Replace the confirm box with a large in-app "Sending help in 5… Cancel" countdown.
2. **Reduce home to three things:** Help, Call Family, and Today (next medicine, with Arya). Move the quote, prescriptions and profile link off home. Cut mood from 5 options to 3.
3. **Cut navigation to four labelled items:** Home, Family, Health, More.
4. **Show elders 6 community tiles** (Notices, Neighbours, Shops, Doctors, Auto, Helplines). Put the rest under "More".
5. **Split Health:** keep "Today's medicines" and appointments for the elder. Move essentials, reports and prescription upload to the caregiver.
6. **Merge reminder toasts and medicine pop-ups** into one stack with 56 px "Taken" and "Later" buttons.

## 5. Family caregiver experience

**Core problem: the dashboard does not answer "Is my parent OK?" in one glance.**

### What the caregiver sees

- **Navigation:** 11 items; the phone bar shows Dashboard, Health, Contacts, Community. Orders, Payments and SOS History sit in the menu (`components/app-shell.tsx:84-94`).
- **Dashboard order on a phone:** heading and invite button, trial banner, the caregiver's own Emergency card with three large buttons, and only then the parent's card (`app/family/page.tsx:27-106`). The parent's card is below the fold (*inferred*).
- **Inside the card:** phone number and "Connected" date come before the status. There is no mood, no last-active time, no call button, and the card cannot be tapped.

### Friction

- **Linking a parent takes about 8 inputs, then the parent must sign in and accept**, with no message sent to them. Date of birth is mandatory and relationship is free text (`app/family/invite/page.tsx:35, 107-173`).
- **Medicine times are typed as "comma-separated, 24h"** (`app/family/health/[elderId]/page.tsx:459-462`).
- **No one-tap call** to the parent from the SOS banner or the dashboard (`components/sos-alert-banner.tsx:234-256`).
- **"Manage billing" opens the parent's association fees.** No plan or subscription page exists (`app/family/page.tsx:50`).
- **Emergency numbers are India-only** (108, 100) and shown to caregivers who may be abroad (`components/emergency-actions.tsx:12-13`).
- **Two patterns for choosing a parent:** tile pickers on three screens, a toggle on four.
- **Jargon:** "Emergency Contact Matrix", "Language pair", "Primary (currently active)".

### Simplify

1. **Put the parent's card first.** Shrink the caregiver's own emergency card to one small button.
2. **Make the card a real status:** one line ("Amma is fine today" or "2 medicines missed"), with Call and WhatsApp buttons, tappable through to health.
3. **Add one parent switcher** at the top of the app. It replaces three picker pages and four toggles.
4. **Cut navigation from 11 to 5:** Home, Health, Shop & Orders, Payments, More.
5. **Shorten the invite to name and phone.** Ask for the rest later.
6. **Use time chips** (Morning, Noon, Evening, Night) for medicine times.
7. **Add a "Plan & billing" page.**

## 6. Service provider experience

**Core problem: the portal is built around forms, while a shopkeeper's day is built around orders.**

### What the provider sees

- **Navigation by category:** every provider gets Overview; shops add Catalog and Orders; doctors add Appointments; drivers add Transport; and so on (`components/app-shell.tsx:144-200`). The portal is English-only.
- **Overview:** 7 stacked blocks, starting with about 11 business-profile inputs, 3 account inputs and 3 password inputs. Shops get no shortcut to Catalog or Orders (`app/provider/page.tsx:18-26`).
- **Catalogue:** about 9 different actions on one screen; each item card carries 5 controls.

### Friction

- **Order status shows raw system words:** a new order reads "paid", a finished one "closed". New and accepted orders share one grey heading, "PENDING FULFILLMENT" (`app/provider/orders/page.tsx:89, 213, 236-238`).
- **Cancel sits beside Confirm as a one-tap 36 px button** on an already-paid order, with no confirmation (`:152`).
- **Cash-on-delivery orders skip the shop's accept step** (`app/api/v1/orders/route.ts:107-114`).
- **Two approval gates with little guidance:** EC verification shows only a badge; a community listing needs a typed join code, then committee approval, then EC approval.
- **Shops cannot see earnings.** The net amount is calculated but never shown.
- **Technical output reaches users:** advisory requests appear as raw JSON (`components/provider/advisory-self-service.tsx:225-227`); errors read "server answered 502".
- **Stale and switched-off items still show:** "Booking requests are coming… not available yet" appears to every provider (`app/provider/page.tsx:136-148`); home-care staff and offers pages show full forms with a disabled button.
- **Doctor slots are added one at a time**, with no weekly hours.

### Simplify

1. **Alert the shop on every new order** and show a count on Orders.
2. **Use plain order states:** "New: accept?", "Packing", "Out for delivery", "Done". Give new orders their own loud section with full-height Accept and Decline, and ask before declining.
3. **Turn Overview into a to-do home:** approval progress, new orders or bookings, and two shortcuts. Move the forms to a Profile page.
4. **Slim the catalogue card** to photo, price and an in-stock switch. Put Edit and Delete behind the card. Hide weight and parcel size under "More details".
5. **Replace the join code with a nearby-community picker**, using the location already captured.
6. **Add an earnings strip** to Orders: today, this week, EC fee, net.
7. **Raise every provider button to at least 44 px.**

## 7. Redundancies to remove

| Area | What is duplicated | Recommendation |
|---|---|---|
| Contacts | "Emergency" and "All Contacts" tabs, two add forms, plus a third list on Health | One list; a star marks an emergency contact |
| SOS | Home card, community "panic alert", Arya voice trigger, each behaving differently | One Help action and one name everywhere |
| Reminders | Top toasts, bottom pop-ups, Health sections | One reminder stack |
| Money | Payments, Bill Pay, "Bill payments" (outside link), community Fees | One "Pay" screen with clear sections |
| Shops, doctors, auto, home services | Listed in both Community and Services | Keep one home for each |
| Promotion | "Featured listing" and "Offers & ads", each with its own payment flow | Merge into Offers & ads |
| Profile | Business phone and account phone on one page; category pages re-ask for phone and area | Ask once and reuse |
| Choosing a parent | 3 near-identical picker pages and 4 toggles | One switcher |
| Wording | Emergency / Need Help Now / panic alert / SOS; Medicines / Medications; Home / Dashboard; catalog / catalogue | One word per idea |
| Code | Payment loader copied into 11 files; a fetch helper re-written in 5; family and elder profile about 75% identical | Share one of each |

## 8. Roadmap

| Wave | Outcome | Items | Effort |
|---|---|---|---|
| **1. Trust** | No false reassurance; no missed orders | S1–S9; plain order states; ask before declining | About 1 week |
| **2. Simplicity** | About 6 choices per screen; help in one tap | Fixed Help button; reduced homes for all three roles; navigation cut to 4–5; parent switcher; larger touch targets; short invite; time chips | 2–3 weeks |
| **3. Consolidation** | One of everything; local language throughout | Merge contacts, SOS paths, reminders, money and promotion; translate the English-only cards; Arya in local languages with a tile fallback; shop earnings; shared code | 4–6 weeks |

### Measures of success

- **Elder:** taps to SOS = 1; choices on home ≤ 6; an elder completes "call my daughter" unaided.
- **Family:** parent status visible without scrolling; time to link a parent under 2 minutes.
- **Provider:** time from order placed to accepted; share of orders accepted within 5 minutes.

### Risks and trade-offs

- **Hiding features lowers discovery.** Put them under "More" and let Arya open them by voice; do not delete them.
- **A one-tap SOS raises false alarms.** The 5-second cancel countdown balances speed and error.
- **These findings come from reading the code.** A half-day test with five elders and three shopkeepers should confirm the priorities before Wave 2 is built.

#ElderCare #UXAudit #DigitalInclusion #AgeTech #ProductStrategy
