# Orbit Foundry — Progress Tracker

Keep this file current whenever work starts or finishes. Newest work-log entry
goes at the top.

## Status snapshot

- **As of:** 2026-10-23
- **Phase:** Prototype 0.3 — binding constraints, downlink, and power failures
- **Build:** Passing (`npm run build`)
- **Next milestone:** Phase 3 — orbital design (altitude and inclination)

## Implemented

- Three.js Earth scene with atmosphere, clouds, stars, orbit ring, and satellite.
- Drag-to-rotate and scroll-to-zoom camera controls.
- Mission design selectors: launcher, instrument, solar array, antenna, budget.
- Live readouts for cost, payload mass, solar margin, and science potential.
- Constraint validation for budget, payload, and power deficit.
- Four-phase simulation: launch, orbit insertion, science, data transmission.
- Mission HUD for progress, battery, data collected/transmitted, link rate, orbit.
- Satellite geometry updates with solar-array size.
- Design controls lock while a mission is running.
- Camera data volume and antenna downlink rate determine how much science data
  reaches the ground during the fixed downlink window.
- Battery model with a constant 18-unit base load, camera draw and antenna draw.
- Battery depletion halts science collection or downlink and is reported as a
  cause in the outcome.
- Three mission outcomes: complete (>=99% of data), partial success (50-99%),
  and failed (<50%), with the decisive cause shown in the debrief text.
- Pre-launch advisories for insufficient downlink capacity and projected battery
  drain beyond the reserve.
- Mission science score is calculated after the run from collected and
  transmitted data.
- Reset flow and responsive layout.

## Design balance (as of 0.3)

- Spacecraft bus, propellant and margin: 70 kg, included in payload.
- Launcher payload limits: economy 120 kg, standard 220 kg, heavy 400 kg.
- Maximum part payload: 155 kg, so the full premium stack is 225 kg.
  It fits the heavy launcher but not the economy or standard launchers.
- Maximum part cost: 158 CR against a 150 CR budget ceiling, so the best parts
  cannot all be purchased at once.
- Viable combinations at the 150 CR ceiling: economy 3, standard 20, heavy 20.
- Camera science data: basic 10, medium 25, advanced 40 units.
- Camera draw: basic 5, medium 12, advanced 22 units.
- Solar output: small 10, medium 22, large 40 units.
- Antenna downlink: basic 2, standard 8, advanced 12 units/sec over 5 seconds.
- Antenna draw: basic 4, standard 8, advanced 14 units.
- Base load: 18 units during active operations. Battery capacity: 100 units.

Example outcomes (5-second science + 5-second downlink):

- Medium camera + medium panel + standard antenna: full success, 75 science,
  ends at about 40% battery.
- Advanced camera + large panel + standard antenna: full success, 100 science,
  ends at 100% battery (heavy launcher required by mass).
- Advanced camera + medium panel + advanced antenna: legal design, but the
  battery depletes during downlink and the mission fails.
- Basic camera + small panel + basic antenna: partial success, battery depletes
  during downlink before all data clears.

## Known gaps

| Priority | Issue | Location |
| --- | --- | --- |
| High | Debrief is a text summary, not a criterion-by-criterion score breakdown | `src/main.ts` completeMission |
| Medium | Orbit is fixed; no altitude or inclination choices | `src/main.ts` mission phases |
| Medium | Only one mission objective | `index.html` |
| Medium | No mid-mission events or player decisions | `src/main.ts` mission update |
| Medium | Solar margin card excludes the base load; the advisory explains the drain | `src/main.ts` refresh |
| Low | No automated tests for resource, downlink, power, or scoring rules | `package.json` |
| Low | No save/load or replay of a configuration | n/a |

## Roadmap

### Phase 1 — Rebalance the economy (done except tests)

- [x] Raise instrument/part mass and cost so launchers and budget bind.
- [x] Narrow the budget range or raise part costs to create real scarcity.
- [x] Add a fixed spacecraft bus mass plus margin so payload limits bind.
- [ ] Add regression tests for budget, mass, and power constraints.

### Phase 2 — Consequential communications and power (done)

- [x] Make downlink rate depend on antenna capacity (data/sec).
- [x] Add a data backlog and a "data lost" outcome when capacity is insufficient.
- [x] Make battery depletion halt science or transmission.
- [x] Add at least one failure path per resource (comms and power).

### Phase 3 — Orbital design (next)

- [ ] Add altitude and inclination selectors.
- [ ] Apply orbital constraints (e.g., launcher performance vs. target orbit).
- [ ] Reflect the chosen orbit in telemetry and the 3D view.

### Phase 4 — Mission variety and debrief

- [ ] Add two or more objectives with distinct success criteria.
- [ ] Add mid-mission events with player decisions.
- [ ] Add a debrief with per-criterion score breakdown and causes.
- [x] Lock design edits while a mission is running.

### Phase 5 — Polish and persistence

- [ ] Add save/load or replay of a configuration.
- [ ] Add sound/visual feedback for critical events.
- [ ] Add automated tests for the simulation phases.
- [x] Update README to match the implemented physics model.

## Work log

### 2026-10-23 — Power model and mission outcomes

- Added an 18-unit constant base load and antenna power draws (4/8/14).
- Battery now drains by `base load + active subsystem - solar output` during
  science and downlink; surplus solar output recharges it.
- Battery depletion stops science collection or downlink immediately.
- Added outcome states: MISSION COMPLETE, PARTIAL SUCCESS, MISSION FAILED.
- Complete requires at least 99% of camera data to be both collected and
  downlinked; below 50% is a failure.
- Debrief now reports collected vs. available data, downlinked vs. collected,
  the decisive cause, and ending battery.
- Added pre-launch power and downlink advisories.
- Rebalanced advanced camera data to 40 units and antenna rates to 2/8/12 so the
  advanced-camera + large-panel + standard-antenna build can fully succeed.
- Verified in headless Chrome: default run completes at 75 science with 40%
  battery; advanced camera + medium panel + advanced antenna fails from battery
  depletion; premium stack is blocked by budget.
- Note: `src/main.ts` was overwritten by an external editor save during work,
  so the Phase 1-3 changes were reapplied before the power work.
- Production build passes.

### 2026-10-23 — Phase 1-3 implementation: binding constraints, downlink, design lock

- Added a 70 kg spacecraft bus/propellant/margin mass to payload calculations.
- Rebalanced part masses and costs against launcher and budget limits.
- Verified via an enumeration script: premium stack is 225 kg (heavy only),
  max cost is 158 CR (cannot buy everything at 150 CR).
- Replaced antenna total-data values with downlink rates of 2/8/12 units/sec.
- Added camera data volumes of 10/25/40 units for the 5-second science phase.
- Downlink now transmits at the antenna rate; leftover data is lost and the
  mission reports "partial success".
- Moved the science score calculation to mission completion and based it on
  actual transmitted data.
- Locked all design controls and the launch button while a mission is running.
- Added a pre-launch advisory when antenna capacity cannot clear the camera data.
- Added link-rate telemetry and a dynamic launcher mass limit in the UI.
- Updated README to match the current model.
- Production build passes after the changes.

### 2026-10-23 — Baseline audit and planning docs

- Read the project source, README, and package configuration.
- Verified the production build passes with Vite 7 and TypeScript.
- Mapped implemented features against the challenge brief.
- Identified non-binding constraints, unused comms capacity, and precomputed
  scoring as the highest-impact gaps.
- Created `docs/PROJECT_GOAL.md` and `docs/PROGRESS.md`.

## Decision log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-10-23 | Use a base load plus active-subsystem draws | Gives solar-array size a real effect during operations |
| 2026-10-23 | Treat below 50% data return as a failed mission | Creates a clear failure threshold instead of a binary pass or vague partial |
| 2026-10-23 | Set advanced-camera data to 40 units | Allows a budget-feasible full-success build with the standard antenna |
| 2026-10-23 | Use a 70 kg bus with a 120/220/400 kg launcher ladder | Makes economy, standard and heavy launchers each viable for different tiers |
| 2026-10-23 | Model downlink as a rate over a fixed window | Gives antenna choice a visible operational consequence |
| 2026-10-23 | Compute score after the run | Makes mission play, not just the design screen, determine the outcome |
| 2026-10-23 | Prioritise constraint rebalancing before new scenery | Tradeoffs are the core of the challenge; visuals already suffice |
| 2026-10-23 | Keep the simulation deterministic and illustrative | Matches the educational scope and the existing prototype |
