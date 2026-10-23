# Orbit Foundry — Space Mission Designer (starter)

A browser-based 3D educational space mission design prototype built with **Three.js + TypeScript + Vite**.

## Requirements
- Node.js 20.19+ or 22.12+ recommended for Vite 7
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

The production site is written to `dist/`. It can be deployed to any static web host that supports single-page/static assets.

## What's implemented
- Textured 3D Earth with atmosphere, clouds, orbit ring, stars and lighting
- Satellite model with selectable solar-array size
- Drag-to-rotate and scroll-to-zoom scene controls
- Launch vehicle, camera, solar panel, antenna and budget selectors
- Live budget, payload, power and science readouts
- Constraint validation for budget, payload and power
- Design controls lock while a mission is running
- Four-phase simulation with battery, science collection and downlink
- Camera data volume and antenna downlink rate determine how much science
  reaches the ground; a short downlink window produces a partial success
- Battery model with a constant base load, instrument draw and antenna draw;
  low-margin designs can brown out during science or downlink
- Mission outcomes are complete, partial success or failed, with the cause
  reported in the debrief message
- Responsive UI for desktop and mobile browser widths

## Important scope limits
This is a learning prototype, not a physically accurate orbital simulator. The Earth texture is stylized; orbit altitude/inclination are illustrative; the simulation is a deterministic rules model. Power, mass and data values are illustrative units, not flight-qualified engineering figures. The displayed payload mass includes a fixed spacecraft bus, propellant and margin allowance plus the selected parts; it is not a full mass budget. Before presenting this as scientifically realistic, replace the placeholder rules with documented engineering assumptions and validated orbital calculations.

## Project tracking
- [Project goal and definition of done](docs/PROJECT_GOAL.md)
- [Progress, known gaps, roadmap, and work log](docs/PROGRESS.md)

## Suggested next steps
1. Move part catalogues, constraints and simulation rules into `src/data/` and `src/sim/`.
2. Add automated tests for budget, payload, power and data-link rules.
3. Add orbit altitude and inclination choices with real design constraints.
4. Add multiple mission objectives, mid-mission events and a detailed debrief.
5. Add save/load and replay of mission configurations.
6. If realistic orbital mechanics are needed, use a dedicated astrodynamics library and clearly document assumptions.
