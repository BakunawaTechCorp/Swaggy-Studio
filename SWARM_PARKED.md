# Swarm — Parked Decisions

**Status:** PARKED. Do not build until PR marketplace (Phase 2B-2D) ships and runs with real users for at least 4 weeks.

**Why parked:** Building two two-sided marketplaces in parallel before either has shipped is the path to neither working. PR ships first; Swarm gets revisited with real-user data.

This doc preserves the design decisions made in the conversation so we don't re-litigate them when work resumes.

---

## What Swarm is

A UGC bounty platform inside Swaggy Studio. Brands post short-video clipping campaigns with credit bounties. Creators (anyone — open marketplace, no media verification gate) submit clips. Brands reward what works.

Distinct from PR marketplace:

| | PR | Swarm |
|---|---|---|
| Who applies | Verified media partners | Anyone |
| Application style | Pitch-and-negotiate | Submit-and-be-rewarded |
| Reward shape | Cash bounty (manual escrow) | Credits (with future cash-out) |
| Verification gate | Required | None |
| Brand selects | One or few partners | Many submissions |
| Success metric | Article published / post live | Performance (view count, engagement) |

---

## Decisions locked in

### Cash-out: YES, eventually

Creator-earned credits will be cash-convertible in the future. This means Swarm becomes a money services product the moment cash-out ships.

**Implication:** Same regulatory category as PR escrow. Build the credit-earning flow first (low-risk, ships when ready). Cash-out flow ships behind a feature flag (`swarmCashOut: false` in `lib/features.ts`) and only flips when legal/banking is greenlit.

The legal/banking work for PR escrow (BSP registration, KYC infra, separate trust account, AML monitoring, BIR withholding) covers Swarm too. Don't redo it; reuse it.

### Reward mechanics: hybrid (brand picks per campaign)

Three reward models, brand picks one when creating a campaign:

1. **Pay-per-submission** — flat credit reward per accepted clip. Brand approves manually. Simplest.
2. **Pay-per-milestone** — first N clips get base credits, top performers get bonus tiers. Medium complexity.
3. **Pay-per-performance** — credits per 1K views/engagement. Highest complexity, requires platform API integrations.

**Implementation order when Swarm is built:**

| Order | Mechanic | Effort | Ships behind flag? |
|---|---|---|---|
| 1 | Pay-per-submission | ~1 week | No — ships first |
| 2 | Pay-per-milestone | ~3 days additional | No |
| 3 | Pay-per-performance | ~2-3 weeks (view-tracking infra) | Yes, until tracking is solid |

The brand-facing "campaign creation" UI shows all three options from day one. Pay-per-performance is labeled "coming soon" until #3 lands.

### Schema: separate tables, not gig_type on pr_gigs

When Swarm is actually built, decision is to NOT shoehorn it into `pr_gigs`. Create dedicated tables: `swarm_campaigns`, `swarm_submissions`, `swarm_payouts`. Reasons:

- Reward mechanics are structurally different (PR is one-winner, Swarm is many-rewards)
- View-tracking columns don't belong on PR gigs
- Separating tables keeps PR queries clean (no `where gig_type = 'pitched'` everywhere)

The shared infrastructure (auth, profiles, credit ledger, connections, kanban) is reused. Only the gig+application flow is duplicated.

---

## Hard prerequisites before Swarm work begins

In strict order:

1. **PR marketplace fully shipped** — Phase 2B (gigs + browse + kanban) → 2C (apps + messaging) → 2D (coordination payments) all live and stable
2. **At least 4 weeks of real PR usage** — minimum 5 brands, 10 partners, 20 gigs posted, 5 successful payouts
3. **Patterns that worked in PR are documented** — what worked, what didn't, what the schema regrets are
4. **PR escrow legal/banking work in progress or done** — Swarm's cash-out depends on this anyway

If any of these aren't true when "build Swarm" comes up again, push back.

---

## What I want future-me to remember

- The "hybrid mechanic" promise is fine to make to brands, but you don't have to ship all three at once. Ship pay-per-submission. Brands will use it. The other two follow when they're ready.
- View tracking is the single biggest engineering risk. Don't underestimate it. TikTok specifically may require partnership program access that takes weeks to obtain.
- Cash-out is a regulatory project, not an engineering project. Most of the work is paperwork.
- Keep the open-marketplace promise. The moment Swarm requires verification to submit, it becomes PR. The whole point is "anyone can clip and submit."
- The credit flywheel (creators earn credits → spend on AI tools) is the elegant part. Don't break it by introducing too many fee structures.

---

## Open questions for when work resumes

- Should Swarm campaigns appear on partner profiles? (cross-promote PR-verified partners as preferred clippers?)
- What's the minimum clip duration / quality bar?
- Do brands review every submission, or auto-approve and reward post-hoc based on performance?
- Is there a "best clip wins" mode separate from the three reward mechanics?
- Anti-fraud: how do we detect view manipulation / fake engagement on submitted clips?

These don't need answers now. They're prompts for whenever this doc gets re-opened.
