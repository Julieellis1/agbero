# AGBERO — Product Requirements Document

**Status:** Draft v0.1 (2026-10-01) — for user review. Numbers marked **[DEFAULT]** are sensible starting values chosen by Rio; veto or change any of them.
**One-line pitch:** A bus-stop tout simulator. You wake up under a Lagos bridge with nothing; a week later you either make quota for the oga or you're back under the bridge — or in hospital.
**Genre:** Systems-driven life sim / arcade brawler hybrid. First-person-ish 3D bus stop (Three.js), decision cards, resource juggling.
**Player role:** You ARE the agbero — flagging down danfos, collecting the daily levies, climbing the escalation ladder when drivers refuse, surviving colleagues, rivals, police, and the Friday quota.

## Design pillars (never break these)

1. **Every loss is readable and escapable.** No danfo-style one-hit surprises — every beating is telegraphed, every risk shown before you commit. Losses must feel earned.
2. **The quota is the clock.** Everything orbits the weekly submission to the oga. Pressure, not punishment for its own sake.
3. **Lagos is the character.** Pidgin dialogue, real street logic (sanitation Saturdays, fuel scarcity, LASTMA), NURTW-flavored hierarchy. If it could happen at Oshodi, it belongs.

## Tech & delivery

- **Engine:** Three.js (web core, same approach as danfo.horpey.dev — verified Three.js r186, hand-rolled arcade physics, no physics engine). Vite build.
- **App wrapper:** Capacitor → Android APK via GitHub Actions (same pipeline as the OMH clinic staff app). One codebase: web link for instant playtesting + installable APK.
- **Target device:** Android phones first (user's device). Big touch targets, bottom-anchored actions, portrait-friendly.
- **Art direction:** Low-poly 3D Lagos bus stop; palette danfo-yellow / charcoal / agbero-red; heavy condensed display type (Anton-style, matching the danfo game's energy); pidgin copy throughout.
- **Audio:** Hand-rolled WebAudio (horn blasts, slap/brawl thumps, cash cha-ching, street ambience loop). Optional radio widget nodding to danfo's Brila FM.

## Opening sequence (playable script)

> **Beat 1 — Under the bridge.** Black screen. Street sounds fade in (distant horns, a generator). Text types out: *"Lagos. 4:47 AM. You sleep where the bridge meets the gutter."* Camera opens on a low-poly under-bridge scene, your character curled in tattered clothes. A danfo rumbles overhead.
>
> **Beat 2 — The wake-up.** Heavy footsteps. A huge silhouette (OGA SULE, 6'4", agbero enforcer) looms. Hoarse voice, subtitled in pidgin: **"Weytin you dey find? You no get house?"** He grabs your collar, lifts you — screen shakes, a fist cocks back.
>
> **Beat 3 — The beg.** Quick-time choice (tap repeatedly to beg): you drop to your knees. Dialogue options: *"Abeg, I no get anywhere to go"* / *"I fit work! Anything!"* He pauses. Studies you. Lowers the fist.
>
> **Beat 4 — The offer.** OGA SULE: **"You fit work as agbero?"** [YES / (no other option — the NO button is greyed out and trembling)] You tap YES.
>
> **Beat 5 — The rules.** Screen goes blank. White chalk text on black, one rule at a time, with a stamp sound:
> 1. *"You go collect money from every danfo wey stop here. Loading fee. Parking fee. Anything wey I call."*
> 2. *"When your colleagues dey fight, you go fight with them. No long thing."*
> 3. *"Every Friday, you go submit my money to head department. No story."*
>
> **Beat 6 — Dawn.** Sun rises over the bus stop. Your Nokia buzzes: *"Oga Sule: Today na Monday. Make ₦5,000 before night. No story."* Tutorial begins: flag your first danfo.

## Cast (vertical slice)

- **OGA SULE** — your recruiter and direct boss. Huge, hoarse, feared. Sends quota threats via Nokia SMS. Miss Friday and his boys visit you.
- **KABIRU** — fellow tout, your age, friendly rival. Backs you in brawls if your Respect is high enough; abandons you if not.
- **MAMA PUT (IYA BOLA)** — food seller. Feeds you on credit in week one (₦200/day). Pay her back or lose crew Respect.
- **THE CHAIRMAN** — unseen in the slice; the "head department." His quota is the final boss of every week.
- **Driver archetypes** (encounter variety): the Fearful (pays fast), the Stubborn Veteran (argues, fights), the Connected (police sticker — pressing him spikes Heat), the Broke (nothing to take; beating him costs you driver goodwill).

## Core loop — one day

1. **Morning briefing (6:00):** Nokia buzzes with today's target and any events (oga inspection, sanitation day, rain). Eat (mama-put ₦200 **[DEFAULT]** or go hungry: -10 max stamina that day).
2. **Work the stop:** Danfos arrive in waves. Tap a bus → encounter card → demand / escalate / release. Collect cash. Colleagues call for help in brawls (join or refuse — Respect moves either way).
3. **Evening count (20:00):** Day-end screen: takings vs daily target, injuries, heat change, crew events. Heal (agbo/hospital), bribe if heat is hot, sleep (under bridge → later: room).
4. **Friday:** Submission day. Hand the weekly quota to Oga Sule's collector. Hit it → rank progress, new territory rumors. Miss it → beating (lose cash + health), quota rolls over with interest **[DEFAULT: +20%]**. Miss twice → cast out (game over: back under the bridge).

**Day phases [DEFAULT]:** Morning rush 6–10 (a danfo every ~45s), Midday lull 10–15 (~2min), Evening rush 15–20 (~60s). Rainy days halve arrivals. Environmental sanitation Saturday: no movement, no income. Sunday: rest (heal small amount free, no quota pressure).

## Systems & numbers (all [DEFAULT], all vetoable)

**Quota (the clock):** Week 1: ₦30,000 (user's figure: a single agbero realistically clears ~₦5,000/day). Daily target ₦5,000. Base fee per danfo: ₦300 (user's figure). Fiction: 400+ danfos pass a busy Lagos stop daily — the player's ~12–16 encounters represent their personal patch of the stop; the rest goes to colleagues, the chairman's cut, and buses that dodge. A danfo yields ₦200–₦500 depending on fees pressed and escalation, so skilled play banks ₦5,000–₦7,000/day — enough for quota plus hospital/bribes/food, tight enough to hurt.

**Escalation ladder (per encounter):** each rung shows success chance, heat cost, injury risk BEFORE you commit —
1. Demand (₦300): 70% pay, +0 heat
2. Block the bus (stand in front): 80% pay, +3 heat, small injury risk if driver nudges forward
3. Slap conductor: 88% pay, +8 heat, conductor may fight back (10–15 dmg)
4. Rip side mirror: 94% pay, +15 heat, driver may brawl (15–25 dmg)
5. Smash windscreen: 97% pay, +25 heat, high brawl risk (20–35 dmg), drivers' goodwill drops
6. Drag driver out: brawl guaranteed (25–40 dmg both sides), +30 heat
7. Full brawl: winner takes all fees + driver's pocket cash; loser hospitalized

**Heat (0–100):** rises with public violence, decays −10/day with no violence **[DEFAULT]**. ≥70: police watch — random LASTMA raid chance each day. 100: raid — arrested, lose a day + ₦2,000 bail **[DEFAULT]**. Bribe: ₦1,000 to −30 heat **[DEFAULT]**.

**Health (100):** brawls deal damage as above. Injuries slow you (move/attack speed −25% while below 40 HP). Hospital: full heal ₦1,000 **[DEFAULT]**. Agbo (herbs): ₦200, heals 40 HP over 2 days. Scars: every hospitalization permanently +5 Fear.

**Fear (0–100) vs Respect (0–100):** Fear rises with successful intimidation/violence — high Fear makes demands succeed more often but raises heat faster and tanks driver goodwill. Respect rises by backing colleagues, paying Mama Put, sparing the broke — high Respect means Kabiru fights beside you and drivers warn you about police. You cannot max both; the endgame asks which you chose.

**Crew:** Kabiru's loyalty tracks Respect. Join his brawls → he joins yours. Refuse twice → he stops answering. (Later scope: recruit your own boys, take a cut, become the collector.)

**Lagos calendar events [DEFAULT]:** rain (half danfos), fuel scarcity (fewer buses, drivers poorer — fees shrink 30%), oga inspection (quota checked mid-week), rival crew incursion (defend your stop or lose a day's takings), police parade (heat +20 for everyone, lie low).

## UI architecture (mobile-first, more load-bearing than danfo's)

- **Bus stop (main 3D view):** compact top bar with icon chips — cash in pocket, today's quota progress (₦/₦1,000), heat meter, health, time of day. Danfos arrive as readable low-poly silhouettes; tap one to engage. Bottom action bar (thumb-reachable): the 7 escalation rungs, each showing its risk before you commit.
- **Encounter card:** driver portrait + archetype tells (trembling hands, police sticker, empty pockets), pidgin dialogue, choices: press / show mercy / walk away. Floating feedback on resolve: cash flies to pocket, Fear/Heat deltas tick up.
- **Nokia phone (second screen):** cracked-screen SMS UI — oga's threats, hospital bills, police warnings, Mama Put's credit reminders, Kabiru's brawl calls.
- **Day-end screen:** takings counted, quota bar, injuries/heat carried forward, heal/bribe/sleep choices.
- **Friday submission:** hand over the quota; success/fail branches play out.
- **Pause:** mute, radio toggle, how-to-play, quit-to-menu.
- **Later scope:** territory map (claim bigger stops), crew panel (recruit boys, stats), rank screen (tout → stop captain → chairman's right hand → park chairman → union executive).

## Scope

**Vertical slice v1 (build this first):** one bus stop, one in-game week (Mon–Sun), the full opening sequence, 4 driver archetypes, 7-rung escalation, quota/heat/health/fear/respect, Kabiru + Mama Put + Oga Sule, hospital/agbo, Friday submission with both outcomes, day-end screens, Nokia phone. Win state: survive the week and make quota. Lose states: missed quota twice (cast out), HP zero with no cash for hospital (debt spiral → cast out).

**Later:** territories (small stop → Oshodi → Mile 2 → CMS), rival crews, police raids as playable sequences, recruitment (you collect from juniors), rank progression, 4 endings (chairman / prison / hospital debt / escape the life), more driver archetypes, radio stations, leaderboard ("most feared tout of Lagos").

## Done criteria (v1)

1. Opening plays start-to-finish on an Android phone with no errors.
2. A full in-game week is completable: quota hittable through normal play, both Friday outcomes reachable.
3. Every escalation rung is usable; risks shown before commit; no unfair-feeling losses (pillar 1 test: playtester can always explain why they lost).
4. APK installs and runs from the GitHub Actions build; web link works for instant playtesting.
5. UI readable at phone size: no overlapping HUD, all buttons ≥48px touch targets, pidgin copy proofread.

## Open questions for the user

1. Numbers above — any quota/fee/price you want changed? (They're all defaults awaiting your veto.)
2. Brawl interaction style: tap-timing mini-game, simple button-mash, or auto-resolved by stats? (Rio leans tap-timing — skill-based, readable.)
3. Tone line: how raw do we go? (Violence is core to the concept, but we choose between stylized-slapsapstick and gritty.)
4. Name for the player's character? (Or keep them nameless — "you.")
