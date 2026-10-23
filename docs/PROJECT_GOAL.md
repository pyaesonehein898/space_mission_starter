# Orbit Foundry — Project Goal

## Vision

Build an interactive, browser-based educational game in which a player designs,
launches, operates, and debriefs a complete space mission. Every engineering
choice must create a visible tradeoff, and every mission outcome must be
traceable to the player's decisions.

## Challenge brief

Designing a space mission requires balancing competing demands: mission
objectives, spacecraft design, scientific instruments, launch vehicles, budgets,
power, mass, communications, and orbital constraints. Students rarely get to
experiment with an entire mission from concept to operation, so these tradeoffs
often remain abstract.

The game must let participants:

1. Design a spacecraft and select a mission profile.
2. Manage limited resources (budget, mass, power, data, time).
3. Make engineering decisions with consequences.
4. Simulate the mission from launch through operations.
5. Evaluate how each choice shaped mission success.

## Core player loop

1. **Choose an objective** that defines success criteria.
2. **Design the mission** — launcher, instruments, power, communications, orbit.
3. **Review constraints** — cost, mass, power, data link, orbital feasibility.
4. **Launch and operate** — react to events, manage battery and downlink.
5. **Debrief** — see the score breakdown and what caused the outcome.

## Required systems

| System | Requirement |
| --- | --- |
| Mission design | Objective, launcher, instrument, power, comms, orbit |
| Resource model | Budget, payload mass, power balance, data throughput |
| Constraints | Each choice must be able to invalidate a design |
| Simulation | Phased mission with time, battery, data, and events |
| Consequences | At least one credible failure path per resource |
| Debrief | Per-criterion score breakdown and causal explanation |
| Persistence | Save/load or replay of a mission configuration (stretch) |

## Design principles

- **Meaningful tradeoffs.** No single "best" build may satisfy every
  constraint. Constraints must bind in realistic ranges.
- **Causality.** The debrief must explain the outcome using the player's
  choices, not opaque or precomputed scores.
- **Learning first.** Show the "why" behind each constraint and failure.
- **Honest scope.** Label simplified physics clearly; never present the model
  as flight software.
- **Readable telemetry.** Live state must be visible and understandable during
  the mission.

## Definition of done

The project is complete when a new player can:

- Pick from at least two distinct objectives with different success criteria.
- Make design choices where at least two options are viable and none is
  strictly dominant.
- Have a design rejected for budget, mass, power, comms, or orbit reasons.
- Run a mission that can succeed or fail based on those choices.
- Receive a debrief that names the decisive choices and suggests improvements.
- Complete the loop on desktop and mobile without external instructions.

## Out of scope (for now)

- Physically accurate orbital propagation or flight-qualified engineering.
- Multiplayer, accounts, or a backend service.
- Real-time 3D flight dynamics beyond the current stylized visualization.

## Success signals

- Every selectable part participates in at least one constraint or failure path.
- The budget and payload limits can actually block otherwise valid designs.
- A player can articulate why their mission succeeded or failed after one run.
