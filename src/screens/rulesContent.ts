/**
 * Player-facing rules — bundled in the app (not the repo README).
 * Keep this focused on how to play; no dev docs, store links, or marketing CTAs.
 */

export const RULES_MARKDOWN = `# Welcome

Welcome to **Presidents & Assholes**.

If this is your first game, start with these four ideas:

1. Your objective
2. How turns work
3. Card rankings
4. Special cards

Most players understand the game after a single round.

---

# The Goal

Your objective is simple:

**Be the first player to get rid of every card in your hand.**

Players are ranked by the order they finish.

| Finish | Rank |
|---------|------|
| First | President |
| Everyone else | Citizen |
| Last | Asshole |

Those rankings carry into the next round.

The President is rewarded.

The Asshole must surrender their best cards.

Winning one round gives you an advantage in the next.

---

# Quick Rules

| Rule | |
|------|------|
| Objective | Empty your hand first |
| Lowest card | 3 |
| Highest card | Joker |
| Opening card | 3♣ |
| Smallest run | Three consecutive ranks |
| A trick ends | When every other active player passes |

---

# How To Play

Players take turns playing cards onto the table.

You may play:

- A single card
- A pair
- Three of a kind
- Four of a kind
- A valid run

Every play must be stronger than the one currently on the table.

If you can't (or choose not to) beat it, press **Pass**.

Once every other active player has passed, the trick ends and the last successful player begins a new one.

> **Important**
>
> Powerful cards do **not** automatically clear the table.
>
> Not 2s.
>
> Not Jokers.
>
> Not four of a kind.
>
> The trick only ends when everyone else passes.

---

# Card Rankings

Cards increase in strength as follows:

| 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | J | Q | K | A | 2 | Joker |
|---|---|---|---|---|---|---|----|---|---|---|---|---|-------|

The Joker is always the strongest card.

---

# Special Rules

## 2

The strongest normal card.

Can only be beaten by:

- Joker
- Four 2s (if fewer than four are already on the table)

Playing a 2 does **not** end the trick.

---

## Joker

The strongest card in the game.

Beats every normal play.

Remains on the table until every other player passes.

---

## Four of a Kind

Four matching cards played together create one of the strongest possible plays.

They may only be beaten by:

- A higher four of a kind
- Joker

If four matching cards are built gradually during the same trick, they become unbeatable.

---

## The 10 Rule

Playing a 10 lets you choose the direction of the next play.

Choose whether the following player must play:

- Higher than 10
- Lower than 10

The effect lasts for one turn.

Runs ignore the 10 Rule.

---

# Runs

Runs are played as **one move** using consecutive ranks.

Examples:

- 4-5-6
- 8-9-10-J
- 10-J-Q-K-A

Pair runs are also allowed:

- 7-7 / 8-8 / 9-9

A valid run must:

- Include at least three ranks
- Be consecutive
- Maintain equal multiplicity

---

# Starting a Round

The first round always begins with **3♣**.

In two-player games, a hidden **Dead Hand** is dealt to balance the deck.

If the Dead Hand contains 3♣, play instead begins with **3♠**.

---

# President & Asshole

Starting from Round Two, rankings matter.

### President

Receives the Asshole's best card(s).

Then chooses **any** card(s) from their own hand to return.

### Asshole

Must give away their strongest card(s).

Receives whatever the President decides to send back.

With five or more players, the Vice President and Vice Asshole also exchange cards.

---

# Game Modes

## Quick Game

Jump straight into a match against AI opponents.

Perfect for learning the rules or playing a quick game.

---

## Online Multiplayer

Create a room, invite your friends, and battle for the Presidency.

Reconnect if your connection briefly drops.

---

# Controls

## Mobile

- Tap cards to select
- Tap again to deselect
- Press **Play**
- Press **Pass**

## Desktop

- Click cards to select
- Click again to deselect
- Press **Esc** to close menus

---

# Beginner Tips

- Don't waste your 2s early.
- Jokers are often worth saving.
- Passing is sometimes the strongest move.
- Runs remove lots of cards quickly.
- Think about your next trick—not just your current one.

---

# Frequently Asked Questions

### Can I play offline?

Yes. Quick Game works without an internet connection.

---

### Can I play with friends?

Yes. Create an online room and share the room code.

---

### Does suit matter?

Normally, no. Suits only determine the opening card.

---

### Why can't I beat a Joker?

Because nothing normally beats a Joker.

---

### Why did I become the Asshole?

Someone had to. Fortunately, every new game is another chance to become President.

---

# Good Luck

Every President started somewhere.

Try not to finish last.
`;

/** Optional footer link — settings / legal screens cover this elsewhere. */
export const RULES_PRIVACY_URL =
  "https://shifuguru.github.io/ps_and_as/privacy.html";
