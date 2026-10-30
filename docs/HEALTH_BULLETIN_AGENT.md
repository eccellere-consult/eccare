# Health bulletin agent

An agent that finds trustworthy health guidance (glaucoma care, staying active, fall prevention, diabetes
care and more), writes a short plain-language bulletin, and hands it to an admin. The admin approves it and it
becomes a **Notice** in the communities they choose, with a ready-to-send **WhatsApp** message.

**An admin always reads it first.** The agent never publishes by itself — these bulletins go to older people
about their health, and one wrong sentence reaching many of them is much worse than a one-tap delay.

## How it works

```
admin clicks "Write a draft"  ─┐
or weekly scheduler calls      ├─►  agent: web search (trusted sites only) ─► writes bulletin ─► safety checks
POST /api/v1/cron/health-…    ─┘                                                                      │
                                                                       blocked ◄──── fails ───────────┤
                                                                    (auto-rejected, with reason)       │ passes
                                                                                                       ▼
                                          admin: Health Bulletins ─► read, edit, ► Approve ─► Notices in chosen communities
                                                                                       └────► WhatsApp message to share
```

- **Sources.** Search is limited to the organisations in `lib/health-sources.ts` (WHO, NHS, NIH/NEI/NIA,
  MedlinePlus, CDC, AAO, Mayo Clinic, Cleveland Clinic, Harvard Health, AHA, ADA, Alzheimer's Association, India's
  MoHFW, National Health Portal, ICMR, AIIMS). To trust another, add it there.
- **Topics.** 17 topics in rotation (`HEALTH_TOPICS`): the one that has gone longest without a bulletin is next, and
  none repeats within 21 days.
- **Safety rules** (`lib/health-bulletin-rules.ts`, tested, enforced in code — not just asked of the model).
  A bulletin is **automatically rejected** if it: cites a source that is not on the trusted list or was not among
  the pages the search actually returned; gives a medicine amount; promises a miracle, a guarantee, "100%" or a
  reversal; tells people to stop or avoid treatment; suggests it replaces a doctor; or never says who to see.
  It is **flagged for the admin** if it uses the word "cure", scary wording, a web address in the text, or hard
  sentences. "There is no cure for glaucoma" and "do not stop your medicines without asking your doctor" are
  recognised as safe. The "not medical advice — talk to your own doctor" line is added by code and cannot be
  edited away; edits are re-checked.
- **Notice.** Posted per community as "Health tip: …", unpinned, by the approving admin. Re-publishing to more
  communities never posts twice to the same one.
- **WhatsApp.** WhatsApp does not let apps post into ordinary groups, so the screen gives the admin the message
  with **Open in WhatsApp** (pick the group, press send) and **Copy**, and lists each community's WhatsApp group
  links as a reminder where to paste. Sending to individual residents automatically would need a Meta-approved
  message template and residents' consent — a separate piece of work.

## Setting it up

1. **An Anthropic API key.** By default the agent shares `ANTHROPIC_API_KEY` with the voice assistant. Better: set
   **`HEALTH_AGENT_API_KEY`** to a key from its own Anthropic workspace with its own spending limit, so a limit on
   one can never switch off the other. In the Anthropic console, switch **web search** on for the organisation.
   Optional: `HEALTH_AGENT_MODEL` (default `claude-sonnet-5-5`).
2. **Database.** A new `HealthBulletin` table; the normal deploy (`prisma db push`) creates it.
3. **Weekly drafting (optional).** This host has no job runner, so use an outside scheduler (Hostinger cron,
   cron-job.org, GitHub Actions…). Set `CRON_SECRET` to a long random value, then call, e.g. every Monday 7 am IST:

   ```bash
   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "https://eccare.in/api/v1/cron/health-bulletins?count=2"
   ```

   It writes up to 3 drafts per call and stops adding once 6 drafts are waiting for review.
4. Admin → **Health Bulletins**.

## If "Write a draft" shows an error

The screen explains the common ones in plain words: the account's **usage limit** was reached (it says when access
returns), it is **out of credit**, the **key** was not accepted, **web search** is not enabled, the **model** name is
not available to the key, or Anthropic is **rate-limiting or busy**.

## Cost and limits

Each draft is one model call with up to 4 web searches (a few US cents). Drafts take up to a minute.
English only for now.

## Not verified here

The model-calling code is tested against simulated API responses in the documented format, not against the live
API (no key was available when it was written). Read the first few drafts carefully, and check the web-search tool
is enabled for your organisation if "Write a draft" reports an API error.
