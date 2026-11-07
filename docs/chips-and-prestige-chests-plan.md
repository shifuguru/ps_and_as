# Poker chips and prestige chests — plan

**Status: proposed; not implemented.** This document describes a first step
for a future reward system, not current game behaviour.

## Goal

Introduce poker chips as a currency separate from XP. XP continues to represent
career progression; chips are rewards that may eventually be spent. For the
first version, earning and opening prestige chests is the focus. A shop, chip
spending, purchases, and other chest contents are out of scope.

Poker-chip colours can represent denominations of a single balance, rather
than separate currencies. Denominations, artwork, and reward amounts still
need to be designed.

## Player experience

1. A player completes an achievement prestige rank through normal play.
2. The Player Hub shows the achievement and completed prestige with a chest
   pending opening. Multiple unclaimed ranks remain visible and claimable.
3. The player chooses to open a chest from the Hub and sees the chip reward.
4. The chips are added to the player's balance, the chest is marked opened,
   and the Hub updates. Opening the Hub alone never claims a chest.
5. The opened state and balance persist between sessions. A failed claim must
   not look successful; the player should be able to retry safely.

The initial reward is chips only. Keep the reward representation extensible so
other rewards can be considered later without changing what existing chests
have already awarded.

## How this fits current progression

- Achievement prestige is derived from career counters. Rank I is the initial
  achievement unlock; later ranks use Fibonacci-spaced thresholds. A single
  stats update can cross multiple ranks.
- The current unlock snapshot detects rank gains, while the recent unlock list
  is capped and is intended for display, not as a durable claim ledger.
- Player stats are stored locally with optional cloud sync; cross-device
  progression is not yet a guaranteed authoritative source. See
  [architecture gaps](../ARCHITECTURE_GAPS.md#xp-and-progression-persistence).
- XP currently includes trick wins and run bonuses. Moving run bonuses to chips
  is a separate proposed change, not part of this chest plan until the reward
  sources and balance are agreed.

## Implementation outline

1. **Define the economy.** Decide whether rank I also awards a chest, the chip
   amount per chest, whether it varies by achievement or rank, and how chip
   colours represent values. Keep amounts configurable and clearly displayed.
2. **Record entitlements.** Give each eligible achievement/rank pair a stable
   identity. Record every newly eligible rank, including multiple ranks crossed
   at once, independently of the capped recent-unlock events.
3. **Persist and claim.** Store pending/opened state and the chip balance
   durably. Make a chest claim and its balance credit one atomic, idempotent
   operation so retries, interruptions, and concurrent opens cannot duplicate
   or lose rewards. Do not rely on the current max-merge of stats to merge a
   spendable balance or claim ledger.
4. **Integrate the Hub.** Surface pending chests alongside the relevant
   achievement and prestige rank, provide an explicit open action and reward
   reveal, and show the chip balance. Handle multiple pending chests and make
   controls accessible and usable with reduced motion.
5. **Account for sync and migration.** Decide how existing prestige ranks are
   treated at launch and establish a reliable authority and reconciliation
   strategy for offline play, reconnects, and linked devices. Existing snapshot
   initialization deliberately does not emit historical unlock events; don't
   infer old chest entitlements from that event list. Preserve existing XP and
   achievement progress.
6. **Test and document.** Cover first unlock and repeat prestige, multi-rank
   gains, reopening and restarting, duplicate or interrupted claims, storage
   failures, and synchronization or migration according to the chosen policy.
   Update player-facing and architecture documentation when behaviour ships.

## Decisions before implementation

- Does the first achievement unlock (prestige rank I) grant a chest, or only
  subsequent prestige ranks?
- Are existing completed ranks rewarded retroactively, and if so how?
- How many chips does each chest contain? Is the amount fixed, rank-based, or
  achievement-based? Are rewards deterministic or random?
- What chip denominations and colours should be used? Where should the balance
  appear beyond the Hub?
- Should runs also award chips instead of their current XP bonus, and how would
  that interact with chest rewards?
- What persistence and authority guarantees should apply offline and across
  devices before a spendable currency is released?
