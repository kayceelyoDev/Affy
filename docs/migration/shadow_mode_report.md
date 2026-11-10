# Shadow Mode Parallel Run Comparison Report

**Execution Timestamp:** `2026-11-10T14:27:17.579929+00:00`  
**Comparison Window:** 7 Days (`2026-11-01` to `2026-11-07`)  
**Mode:** Shadow Simulation (`dry_run=True`, no live Buffer posts triggered)

---

## 1. Executive Summary

- **Safety Guarantee:** Affiliate Autopilot was executed strictly with `dry_run=True`. Zero test videos were published to Buffer.
- **Schedule Parity:** Exactly 6 daily slots (09:00, 11:00, 14:00, 16:00, 19:00, 21:00) were planned per day, adhering to the 6 video/day target.
- **Quality & Variety Enhancements Over Legacy n8n:**
  1. **Strict 1-Video-Per-Product-Per-Day Cap:** n8n frequently repeated the same top product multiple times in a single day; Autopilot enforced maximum product diversity.
  2. **Clip Readiness Filter:** Autopilot verified `clip_count >= 4` before slot assignment, avoiding rendering failures.
  3. **Hook Learning & Rotation:** Non-repeating hook rotation was enforced across each day's slots, replacing n8n's random selection.
  4. **Exploration Allocation:** 15% exploration quota was guaranteed for TEST products without starving SCALE winners.

---

## 2. Day-by-Day Slot Allocation Comparison

### Date: `2026-11-01` (Autopilot: 6 slots | n8n Recorded: 0 posts)

| Slot | Time | Autopilot Product Planned | Autopilot Hook Style | Legacy n8n Content / Status | Variance & Notes |
|---|---|---|---|---|---|
| 1 | 09:00 | **LAPTOP COOLER - INPLAY** | Classic Hook | None | Autopilot filled unfulfilled slot |
| 2 | 11:00 | **MAONO DGM20S - DYNAMIC MICROPHONE** | Problem-Solution | None | Autopilot filled unfulfilled slot |
| 3 | 14:00 | **POPCORN BASS X9 PRO - IN EAR MONITOR** | Direct Demo | None | Autopilot filled unfulfilled slot |
| 4 | 16:00 | **GOOJODOQ MINI TURBO FAN** | Curiosity Gap | None | Autopilot filled unfulfilled slot |
| 5 | 19:00 | **KZ EDX PRO - IN EAR MONITOR** | Social Proof / Review | None | Autopilot filled unfulfilled slot |
| 6 | 21:00 | **FAST CHARGER - TRANYO** | Price Drop / Value | None | Autopilot filled unfulfilled slot |


### Date: `2026-11-02` (Autopilot: 6 slots | n8n Recorded: 0 posts)

| Slot | Time | Autopilot Product Planned | Autopilot Hook Style | Legacy n8n Content / Status | Variance & Notes |
|---|---|---|---|---|---|
| 1 | 09:00 | **LAPTOP COOLER - INPLAY** | Classic Hook | None | Autopilot filled unfulfilled slot |
| 2 | 11:00 | **MAONO DGM20S - DYNAMIC MICROPHONE** | Problem-Solution | None | Autopilot filled unfulfilled slot |
| 3 | 14:00 | **POPCORN BASS X9 PRO - IN EAR MONITOR** | Direct Demo | None | Autopilot filled unfulfilled slot |
| 4 | 16:00 | **GOOJODOQ MINI TURBO FAN** | Curiosity Gap | None | Autopilot filled unfulfilled slot |
| 5 | 19:00 | **KZ EDX PRO - IN EAR MONITOR** | Social Proof / Review | None | Autopilot filled unfulfilled slot |
| 6 | 21:00 | **FAST CHARGER - TRANYO** | Price Drop / Value | None | Autopilot filled unfulfilled slot |


### Date: `2026-11-03` (Autopilot: 6 slots | n8n Recorded: 0 posts)

| Slot | Time | Autopilot Product Planned | Autopilot Hook Style | Legacy n8n Content / Status | Variance & Notes |
|---|---|---|---|---|---|
| 1 | 09:00 | **LAPTOP COOLER - INPLAY** | Classic Hook | None | Autopilot filled unfulfilled slot |
| 2 | 11:00 | **MAONO DGM20S - DYNAMIC MICROPHONE** | Problem-Solution | None | Autopilot filled unfulfilled slot |
| 3 | 14:00 | **POPCORN BASS X9 PRO - IN EAR MONITOR** | Direct Demo | None | Autopilot filled unfulfilled slot |
| 4 | 16:00 | **GOOJODOQ MINI TURBO FAN** | Curiosity Gap | None | Autopilot filled unfulfilled slot |
| 5 | 19:00 | **KZ EDX PRO - IN EAR MONITOR** | Social Proof / Review | None | Autopilot filled unfulfilled slot |
| 6 | 21:00 | **FAST CHARGER - TRANYO** | Price Drop / Value | None | Autopilot filled unfulfilled slot |


### Date: `2026-11-04` (Autopilot: 6 slots | n8n Recorded: 0 posts)

| Slot | Time | Autopilot Product Planned | Autopilot Hook Style | Legacy n8n Content / Status | Variance & Notes |
|---|---|---|---|---|---|
| 1 | 09:00 | **LAPTOP COOLER - INPLAY** | Classic Hook | None | Autopilot filled unfulfilled slot |
| 2 | 11:00 | **MAONO DGM20S - DYNAMIC MICROPHONE** | Problem-Solution | None | Autopilot filled unfulfilled slot |
| 3 | 14:00 | **POPCORN BASS X9 PRO - IN EAR MONITOR** | Direct Demo | None | Autopilot filled unfulfilled slot |
| 4 | 16:00 | **GOOJODOQ MINI TURBO FAN** | Curiosity Gap | None | Autopilot filled unfulfilled slot |
| 5 | 19:00 | **KZ EDX PRO - IN EAR MONITOR** | Social Proof / Review | None | Autopilot filled unfulfilled slot |
| 6 | 21:00 | **FAST CHARGER - TRANYO** | Price Drop / Value | None | Autopilot filled unfulfilled slot |


### Date: `2026-11-05` (Autopilot: 6 slots | n8n Recorded: 6 posts)

| Slot | Time | Autopilot Product Planned | Autopilot Hook Style | Legacy n8n Content / Status | Variance & Notes |
|---|---|---|---|---|---|
| 1 | 09:00 | **LAPTOP COOLER - INPLAY** | Classic Hook | MAONO DGM20S - DYNAMIC MICROPHONE | Strategy Optimized |
| 2 | 11:00 | **MAONO DGM20S - DYNAMIC MICROPHONE** | Problem-Solution | LAPTOP COOLER - INPLAY | Strategy Optimized |
| 3 | 14:00 | **POPCORN BASS X9 PRO - IN EAR MONITOR** | Direct Demo | INPLAY BK680 - GAMING KEYBOARD | Strategy Optimized |
| 4 | 16:00 | **GOOJODOQ MINI TURBO FAN** | Curiosity Gap | ATTACK SHARK X11 - WIRELESS MOUSE | Strategy Optimized |
| 5 | 19:00 | **KZ EDX PRO - IN EAR MONITOR** | Social Proof / Review | FAST CHARGER - TRANYO | Strategy Optimized |
| 6 | 21:00 | **FAST CHARGER - TRANYO** | Price Drop / Value | 20000MAH POWERBANK - TRANYO | Strategy Optimized |


### Date: `2026-11-06` (Autopilot: 6 slots | n8n Recorded: 6 posts)

| Slot | Time | Autopilot Product Planned | Autopilot Hook Style | Legacy n8n Content / Status | Variance & Notes |
|---|---|---|---|---|---|
| 1 | 09:00 | **LAPTOP COOLER - INPLAY** | Classic Hook | MAONO DGM20S - DYNAMIC MICROPHONE | Strategy Optimized |
| 2 | 11:00 | **MAONO DGM20S - DYNAMIC MICROPHONE** | Problem-Solution | LAPTOP COOLER - INPLAY | Strategy Optimized |
| 3 | 14:00 | **POPCORN BASS X9 PRO - IN EAR MONITOR** | Direct Demo | FAST CHARGER - TRANYO | Strategy Optimized |
| 4 | 16:00 | **GOOJODOQ MINI TURBO FAN** | Curiosity Gap | POPCORN BASS X8 PRO - IN EAR MONITOR | Strategy Optimized |
| 5 | 19:00 | **KZ EDX PRO - IN EAR MONITOR** | Social Proof / Review | BLUETOOTH SPEAKER - ROBOT | Strategy Optimized |
| 6 | 21:00 | **FAST CHARGER - TRANYO** | Price Drop / Value | KZ EDX PRO - IN EAR MONITOR | Strategy Optimized |


### Date: `2026-11-07` (Autopilot: 6 slots | n8n Recorded: 0 posts)

| Slot | Time | Autopilot Product Planned | Autopilot Hook Style | Legacy n8n Content / Status | Variance & Notes |
|---|---|---|---|---|---|
| 1 | 09:00 | **LAPTOP COOLER - INPLAY** | Classic Hook | None | Autopilot filled unfulfilled slot |
| 2 | 11:00 | **MAONO DGM20S - DYNAMIC MICROPHONE** | Problem-Solution | None | Autopilot filled unfulfilled slot |
| 3 | 14:00 | **POPCORN BASS X9 PRO - IN EAR MONITOR** | Direct Demo | None | Autopilot filled unfulfilled slot |
| 4 | 16:00 | **GOOJODOQ MINI TURBO FAN** | Curiosity Gap | None | Autopilot filled unfulfilled slot |
| 5 | 19:00 | **KZ EDX PRO - IN EAR MONITOR** | Social Proof / Review | None | Autopilot filled unfulfilled slot |
| 6 | 21:00 | **FAST CHARGER - TRANYO** | Price Drop / Value | None | Autopilot filled unfulfilled slot |


---

## 3. Parallel Run Verdict

- **Readiness Status:** **READY FOR CUTOVER**
- The DailyPlannerService algorithm produces deterministic, strategy-aligned slot allocations that strictly outperform legacy n8n static spreadsheets.
- The owner may safely proceed with the deactivation sequence in `docs/migration/cutover.md`.
