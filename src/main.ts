import * as THREE from 'three';
import './style.css';

type Part = {
  cost: number;
  mass: number;
  power?: number;
  science?: number;
  dataVolume?: number;
  downlink?: number;
  payload?: number;
};

// Spacecraft bus, propellant, and margin. The launcher must carry this plus all parts.
const SPACECRAFT_BUS_MASS = 70;
// Constant avionics, thermal and attitude-control load while the spacecraft is active.
const BASE_LOAD = 18;

const rockets: Record<string, Part> = {
  economy: { cost: 20, mass: 100, payload: 120 },
  standard: { cost: 35, mass: 160, payload: 220 },
  heavy: { cost: 55, mass: 250, payload: 400 },
};
const cameras: Record<string, Part> = {
  basic: { cost: 10, mass: 12, power: 5, science: 40, dataVolume: 10 },
  medium: { cost: 25, mass: 30, power: 12, science: 75, dataVolume: 25 },
  advanced: { cost: 45, mass: 60, power: 22, science: 100, dataVolume: 40 },
};
const panels: Record<string, Part> = {
  small: { cost: 8, mass: 12, power: 10 },
  medium: { cost: 18, mass: 28, power: 22 },
  large: { cost: 32, mass: 55, power: 40 },
};
const antennas: Record<string, Part> = {
  basic: { cost: 5, mass: 8, power: 4, downlink: 2 },
  standard: { cost: 14, mass: 18, power: 8, downlink: 8 },
  advanced: { cost: 26, mass: 40, power: 14, downlink: 12 },
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const rocketSelect = $('rocket') as HTMLSelectElement;
const cameraSelect = $('camera') as HTMLSelectElement;
const panelSelect = $('panel') as HTMLSelectElement;
const antennaSelect = $('antenna') as HTMLSelectElement;
const budgetInput = $('budget') as HTMLInputElement;
const runButton = $('runButton') as HTMLButtonElement;
const resetButton = $('resetButton') as HTMLButtonElement;
const designControls = [rocketSelect, cameraSelect, panelSelect, antennaSelect, budgetInput];

function setDesignLocked(locked: boolean) {
  for (const control of designControls) control.disabled = locked;
  runButton.disabled = locked;
}

let simulationRunning = false;
let elapsed = 0;
let lastFrame = 0;
let phaseElapsed = 0;
let phaseIndex = 0;
let scienceScore = 0;
let hudUpdateAccumulator = 0;

const TOTAL_MISSION_TIME = 20;
const MAX_BATTERY = 100;
let batteryLevel = MAX_BATTERY;
let dataCollected = 0;
let dataTransmitted = 0;
let orbitAngle = 0;
let sciencePowerFailure = false;
let downlinkPowerFailure = false;

type MissionPhase = { name: string; duration: number; message: string };
const missionPhases: MissionPhase[] = [
  { name: 'LAUNCH', duration: 5, message: 'Launch vehicle is carrying the satellite into space.' },
  { name: 'ORBIT INSERTION', duration: 5, message: 'Satellite is entering the demonstration orbit.' },
  { name: 'SCIENCE OPERATIONS', duration: 5, message: 'Satellite camera is collecting Earth observation data.' },
  { name: 'DATA TRANSMISSION', duration: 5, message: 'Satellite is transmitting collected data to the ground.' },
];

function getDesign() {
  const r = rockets[rocketSelect.value];
  const c = cameras[cameraSelect.value];
  const p = panels[panelSelect.value];
  const a = antennas[antennaSelect.value];
  const cost = r.cost + c.cost + p.cost + a.cost;
  const payloadMass = SPACECRAFT_BUS_MASS + c.mass + p.mass + a.mass;
  const panelPower = p.power ?? 0;
  const cameraPower = c.power ?? 0;
  const antennaPower = a.power ?? 0;
  const powerBalance = panelPower - cameraPower;
  const budget = Number(budgetInput.value);
  const payloadLimit = r.payload ?? 0;
  const dataVolume = c.dataVolume ?? 0;
  const downlinkRate = a.downlink ?? 0;
  const issues: string[] = [];
  if (cost > budget) issues.push(`Over budget by ${cost - budget} credits.`);
  if (payloadMass > payloadLimit) issues.push(`Payload exceeds launcher capacity by ${payloadMass - payloadLimit} kg.`);
  if (powerBalance < 0) issues.push(`Power deficit of ${Math.abs(powerBalance)} units. Choose a larger solar array.`);
  return {
    cost, payloadMass, powerBalance, panelPower, cameraPower, antennaPower,
    science: c.science ?? 0, dataVolume, downlinkRate, budget, payloadLimit, issues,
  };
}

function setText(id: string, value: string | number) {
  $(id).textContent = String(value);
}

function setBar(id: string, value: number, max: number) {
  const bar = $(id) as HTMLDivElement;
  const safeMax = Math.max(1, max);
  bar.style.width = `${Math.min(100, Math.max(0, value / safeMax * 100))}%`;
  bar.classList.toggle('bar-danger', value > max || value < 0);
}

// Mission HUD is inserted into the existing #scene element.
const host = $('scene');
const missionHud = document.createElement('div');
missionHud.id = 'missionHud';
missionHud.innerHTML = `
  <div class="hud-heading">MISSION TELEMETRY</div>
  <div class="hud-item">
    <div class="hud-row"><span>MISSION PROGRESS</span><strong id="hudProgressText">0%</strong></div>
    <div class="hud-track"><div id="hudProgressBar" class="hud-fill"></div></div>
  </div>
  <div class="hud-item">
    <div class="hud-row"><span>BATTERY</span><strong id="hudBatteryText">100%</strong></div>
    <div class="hud-track"><div id="hudBatteryBar" class="hud-fill battery-fill"></div></div>
  </div>
  <div class="hud-item">
    <div class="hud-row"><span>DATA COLLECTED</span><strong id="hudDataText">0 / 25 units</strong></div>
    <div class="hud-track"><div id="hudDataBar" class="hud-fill data-fill"></div></div>
    <div class="hud-subtext">Transmitted: <span id="hudTransmittedText">0%</span> · Link: <span id="hudLinkRateText">0 u/s</span></div>
  </div>
  <div class="hud-item">
    <div class="hud-row"><span>ORBIT POSITION</span><strong id="hudOrbitText">0°</strong></div>
    <div class="hud-track"><div id="hudOrbitBar" class="hud-fill orbit-fill"></div></div>
    <div class="hud-subtext" id="hudOrbitStatus">Awaiting launch</div>
  </div>
`;
host.appendChild(missionHud);

const hudStyle = document.createElement('style');
hudStyle.textContent = `
  #scene { position: relative; overflow: hidden; }
  #missionHud {
    position: absolute; top: 12px; left: 12px; z-index: 5;
    width: min(250px, calc(100% - 24px)); box-sizing: border-box; padding: 14px;
    border: 1px solid rgba(104,166,255,.28); border-radius: 12px;
    background: rgba(4,12,29,.88); color: #e5efff;
    font: 12px/1.4 system-ui,sans-serif; pointer-events: none; backdrop-filter: blur(8px);
  }
  #missionHud .hud-heading { margin-bottom: 14px; color: #80b9ff; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; }
  #missionHud .hud-item { margin-top: 12px; }
  #missionHud .hud-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
  #missionHud .hud-row span { color: #aabbd5; font-size: 10px; letter-spacing: .5px; }
  #missionHud .hud-row strong { color: #fff; font-size: 12px; white-space: nowrap; }
  #missionHud .hud-track { height: 6px; overflow: hidden; border-radius: 10px; background: rgba(164,188,225,.16); }
  #missionHud .hud-fill { width: 0%; height: 100%; border-radius: inherit; background: #5aabff; transition: width .15s linear; }
  #missionHud .battery-fill { background: #50d6a0; }
  #missionHud .battery-fill.bar-danger { background: #ff5d70; }
  #missionHud .data-fill { background: #c18aff; }
  #missionHud .orbit-fill { background: #64cfff; }
  #missionHud .hud-subtext { margin-top: 5px; color: #8fa5c7; font-size: 10px; }
`;
document.head.appendChild(hudStyle);

// Three.js scene and renderer.
const scene = new THREE.Scene();
scene.background = new THREE.Color('#050b17');
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(0, 0, 13);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
host.prepend(renderer.domElement);

const root = new THREE.Group();
scene.add(root);
scene.add(new THREE.AmbientLight(0x7791bd, 1.8));
const sun = new THREE.DirectionalLight(0xffffff, 3.2);
sun.position.set(-6, 8, 7);
scene.add(sun);

// Textures must exist in public/textures/earth.jpg and public/textures/clouds.jpg.
const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load('/textures/earth.jpg');
earthTexture.colorSpace = THREE.SRGBColorSpace;
const cloudTexture = textureLoader.load('/textures/clouds.jpg');

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(3, 64, 48),
  new THREE.MeshStandardMaterial({ map: earthTexture, roughness: 0.95, metalness: 0 }),
);
root.add(earth);

const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(3.035, 64, 48),
  new THREE.MeshStandardMaterial({
    color: 0xffffff, alphaMap: cloudTexture, transparent: true,
    opacity: 0.6, depthWrite: false, roughness: 1,
  }),
);
root.add(clouds);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(3.13, 64, 48),
  new THREE.MeshBasicMaterial({
    color: 0x3c9fff, transparent: true, opacity: 0.12,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
  }),
);
root.add(atmosphere);

// Orbit ring.
const orbitPoints: THREE.Vector3[] = [];
for (let i = 0; i <= 240; i++) {
  const t = i / 240 * Math.PI * 2;
  orbitPoints.push(new THREE.Vector3(Math.cos(t) * 4.35, Math.sin(t) * 0.85, Math.sin(t) * 4.35));
}
root.add(new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(orbitPoints),
  new THREE.LineBasicMaterial({ color: 0x4b9dff, transparent: true, opacity: 0.55 }),
));

// Satellite model.
let satellite = new THREE.Group();
root.add(satellite);

function updateSatellite() {
  root.remove(satellite);
  satellite.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const material = obj.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
    }
  });

  satellite = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.42, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xc7d3e4, metalness: 0.8, roughness: 0.28 }),
  );
  satellite.add(body);

  const gold = new THREE.MeshStandardMaterial({ color: 0xe2a84d, metalness: 0.65, roughness: 0.35 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x1763ba, metalness: 0.35, roughness: 0.4, emissive: 0x061c44 });
  const panelWidth = panelSelect.value === 'small' ? 0.7 : panelSelect.value === 'medium' ? 1 : 1.35;

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.06), gold);
    arm.position.x = side * 0.43;
    satellite.add(arm);

    const solar = new THREE.Mesh(new THREE.BoxGeometry(panelWidth, 0.08, 0.58), blue);
    solar.position.x = side * (0.72 + panelWidth / 2);
    satellite.add(solar);

    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.085, 0.58), gold);
      line.position.set(side * (0.72 + panelWidth * (i + 0.5) / 4), 0.045, 0);
      satellite.add(line);
    }
  }

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8), gold);
  mast.position.y = 0.34;
  satellite.add(mast);

  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xdde7f4, metalness: 0.7, roughness: 0.25, side: THREE.DoubleSide }),
  );
  dish.rotation.x = Math.PI;
  dish.position.set(0, 0.5, 0);
  satellite.add(dish);

  satellite.position.set(4.35, 0, 0);
  satellite.scale.setScalar(0.8);
  root.add(satellite);
}

function updateMissionHud() {
  const d = getDesign();
  const progress = simulationRunning
    ? Math.min(100, elapsed / TOTAL_MISSION_TIME * 100)
    : elapsed >= TOTAL_MISSION_TIME ? 100 : 0;

  setText('hudProgressText', `${Math.floor(progress)}%`);
  setBar('hudProgressBar', progress, 100);

  const battery = Math.round(THREE.MathUtils.clamp(batteryLevel, 0, MAX_BATTERY));
  setText('hudBatteryText', `${battery}%`);
  setBar('hudBatteryBar', battery, MAX_BATTERY);
  $('hudBatteryBar').classList.toggle('bar-danger', battery <= 20);

  setText('hudDataText', `${dataCollected.toFixed(1)} / ${d.dataVolume} units`);
  setBar('hudDataBar', dataCollected, Math.max(1, d.dataVolume));

  const transmissionPercent = dataCollected > 0 ? dataTransmitted / dataCollected * 100 : 0;
  setText('hudTransmittedText', `${Math.floor(transmissionPercent)}%`);
  setText('hudLinkRateText', `${d.downlinkRate} u/s`);

  const angleDegrees = Math.floor(THREE.MathUtils.euclideanModulo(orbitAngle, Math.PI * 2) * 180 / Math.PI);
  setText('hudOrbitText', `${angleDegrees}°`);
  setBar('hudOrbitBar', angleDegrees, 360);

  let orbitStatus = 'Awaiting launch';
  if (simulationRunning && phaseIndex === 0) orbitStatus = 'Launch in progress';
  else if (simulationRunning && phaseIndex === 1) orbitStatus = 'Orbit insertion';
  else if (simulationRunning && phaseIndex === 2) orbitStatus = 'Science orbit';
  else if (simulationRunning && phaseIndex === 3) orbitStatus = 'Transmitting from orbit';
  else if (!simulationRunning && elapsed >= TOTAL_MISSION_TIME) orbitStatus = 'Mission complete';
  setText('hudOrbitStatus', orbitStatus);
}

function refresh() {
  const d = getDesign();
  setText('budgetValue', d.budget);
  setText('budgetLimit', d.budget);
  setText('costValue', d.cost);
  setText('massValue', d.payloadMass);
  setText('massLimit', d.payloadLimit);
  setText('powerValue', `${d.powerBalance >= 0 ? '+' : ''}${d.powerBalance}`);
  setText('scienceValue', d.science);
  setBar('costBar', d.cost, d.budget);
  setBar('massBar', d.payloadMass, d.payloadLimit);
  setBar('powerBar', d.powerBalance, 40);
  setBar('scienceBar', d.science, 100);

  const pill = $('statusPill');
  pill.textContent = d.issues.length ? 'NEEDS ADJUSTMENT' : 'DESIGN VIABLE';
  pill.classList.remove('status-running', 'status-warning');
  pill.classList.toggle('status-danger', d.issues.length > 0);

  const downlinkCapacity = d.downlinkRate * missionPhases[3].duration;
  const downlinkNote = downlinkCapacity < d.dataVolume
    ? ` The downlink can carry only ${downlinkCapacity} of ${d.dataVolume} data units; expect lost science.`
    : '';
  const scienceDrain = Math.max(0, BASE_LOAD + d.cameraPower - d.panelPower) * missionPhases[2].duration;
  const downlinkDrain = Math.max(0, BASE_LOAD + d.antennaPower - d.panelPower) * missionPhases[3].duration;
  const powerNote = scienceDrain + downlinkDrain > MAX_BATTERY
    ? ` Projected operations draw ${Math.round(scienceDrain + downlinkDrain)} battery units against a ${MAX_BATTERY}-unit reserve; the battery may not last.`
    : '';
  $('feedback').textContent = d.issues.length
    ? d.issues.join(' ')
    : `Design constraints satisfied.${downlinkNote}${powerNote} Run the simulation to evaluate mission performance.`;

  updateSatellite();
  updateMissionHud();
}

function startMission() {
  if (simulationRunning) return;
  const d = getDesign();
  const pill = $('statusPill');

  if (d.issues.length) {
    simulationRunning = false;
    pill.textContent = 'SIMULATION BLOCKED';
    pill.classList.remove('status-running');
    pill.classList.add('status-danger');
    $('feedback').textContent = `Launch aborted: ${d.issues.join(' ')} Fix the design and try again.`;
    updateMissionHud();
    return;
  }

  elapsed = 0;
  phaseElapsed = 0;
  phaseIndex = 0;
  hudUpdateAccumulator = 0;
  batteryLevel = MAX_BATTERY;
  dataCollected = 0;
  dataTransmitted = 0;
  orbitAngle = 0;
  sciencePowerFailure = false;
  downlinkPowerFailure = false;
  satellite.position.set(4.35, 0, 0);
  satellite.rotation.set(0, 0, 0);

  simulationRunning = true;
  setDesignLocked(true);
  pill.textContent = missionPhases[0].name;
  pill.classList.remove('status-danger', 'status-warning');
  pill.classList.add('status-running');
  $('feedback').textContent = missionPhases[0].message;
  setText('elapsed', '00:00');
  updateMissionHud();
}

function updateMission(dt: number) {
  if (!simulationRunning) return;

  elapsed += dt;
  phaseElapsed += dt;

  const d = getDesign();
  const currentPhase = missionPhases[phaseIndex];
  setText('elapsed', `00:${String(Math.floor(elapsed)).padStart(2, '0')}`);
  orbitAngle = elapsed * 0.42;

  if (phaseIndex === 2) {
    batteryLevel += (d.panelPower - d.cameraPower - BASE_LOAD) * dt;
    if (batteryLevel > 0) {
      const collectionRate = d.dataVolume / missionPhases[2].duration;
      dataCollected = Math.min(d.dataVolume, dataCollected + collectionRate * dt);
    } else {
      sciencePowerFailure = dataCollected < d.dataVolume - 0.01;
    }
  } else if (phaseIndex === 3) {
    batteryLevel += (d.panelPower - d.antennaPower - BASE_LOAD) * dt;
    if (batteryLevel > 0) {
      dataTransmitted = Math.min(dataCollected, dataTransmitted + d.downlinkRate * dt);
    } else {
      downlinkPowerFailure = dataTransmitted < dataCollected - 0.01;
    }
  }

  batteryLevel = THREE.MathUtils.clamp(batteryLevel, 0, MAX_BATTERY);

  // Update telemetry at 10 Hz, while keeping the 3D animation smooth.
  hudUpdateAccumulator += dt;
  if (hudUpdateAccumulator >= 0.1) {
    updateMissionHud();
    hudUpdateAccumulator = 0;
  }

  if (phaseElapsed < currentPhase.duration) return;

  phaseElapsed = 0;
  phaseIndex++;

  if (phaseIndex >= missionPhases.length) {
    elapsed = TOTAL_MISSION_TIME;
    completeMission();
    updateMissionHud();
    return;
  }

  const nextPhase = missionPhases[phaseIndex];
  $('statusPill').textContent = nextPhase.name;
  $('feedback').textContent = nextPhase.message;
  updateMissionHud();
}

function completeMission() {
  simulationRunning = false;
  setDesignLocked(false);

  const d = getDesign();
  const collectionRatio = d.dataVolume > 0 ? dataCollected / d.dataVolume : 0;
  const transmissionRatio = dataCollected > 0 ? dataTransmitted / dataCollected : 0;
  const overallRatio = collectionRatio * transmissionRatio;
  scienceScore = Math.round(d.science * overallRatio);

  const success = overallRatio >= 0.99;
  const failed = overallRatio < 0.5;
  const uncollected = Math.max(0, d.dataVolume - dataCollected);
  const queued = Math.max(0, dataCollected - dataTransmitted);
  const causes: string[] = [];

  if (sciencePowerFailure) {
    causes.push(`the battery ran out during science, leaving ${uncollected.toFixed(1)} data units uncollected`);
  }
  if (downlinkPowerFailure) {
    causes.push(`the battery ran out during downlink with ${queued.toFixed(1)} data units still queued`);
  }
  if (!downlinkPowerFailure && queued > 0.01) {
    causes.push(`the antenna could not clear ${queued.toFixed(1)} data units within the downlink window`);
  }

  const pill = $('statusPill');
  pill.textContent = success ? 'MISSION COMPLETE' : failed ? 'MISSION FAILED' : 'PARTIAL SUCCESS';
  pill.classList.remove('status-running', 'status-danger', 'status-warning');
  if (failed) pill.classList.add('status-danger');
  else if (!success) pill.classList.add('status-warning');

  const outcome = causes.length
    ? `Cause: ${causes.join('; ')}.`
    : 'All collected science data reached the ground.';
  $('feedback').textContent =
    `Science score: ${scienceScore}/100. ` +
    `Collected ${dataCollected.toFixed(1)} / ${d.dataVolume} data units and ` +
    `downlinked ${dataTransmitted.toFixed(1)} / ${dataCollected.toFixed(1)}. ` +
    `${outcome} Ending battery: ${Math.round(batteryLevel)}%. ` +
    `This is a simplified educational simulation, not a real orbital prediction.`;
}

function resize() {
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
resize();
new ResizeObserver(resize).observe(host);

// Starfield.
const starPositions = new Float32Array(900 * 3);
for (let i = 0; i < 900; i++) {
  starPositions[i * 3] = (Math.random() - 0.5) * 90;
  starPositions[i * 3 + 1] = (Math.random() - 0.5) * 70;
  starPositions[i * 3 + 2] = (Math.random() - 0.5) * 90;
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
scene.add(new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({ color: 0xc4d9ff, size: 0.075, transparent: true, opacity: 0.8 }),
));

// Pointer controls: drag rotates the scene; wheel zooms.
let dragging = false;
let lastX = 0;
let lastY = 0;
host.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  host.setPointerCapture(event.pointerId);
});
host.addEventListener('pointerup', () => { dragging = false; });
host.addEventListener('pointercancel', () => { dragging = false; });
host.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  root.rotation.y += (event.clientX - lastX) * 0.005;
  root.rotation.x += (event.clientY - lastY) * 0.003;
  lastX = event.clientX;
  lastY = event.clientY;
});
host.addEventListener('wheel', (event) => {
  camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * 0.008, 7, 22);
}, { passive: true });

function animate(now = 0) {
  requestAnimationFrame(animate);
  const dt = lastFrame === 0 ? 0 : Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  earth.rotation.y += dt * 0.035;
  clouds.rotation.y += dt * 0.045;
  updateMission(dt);

  if (simulationRunning && phaseIndex >= 1) {
    satellite.position.set(
      Math.cos(elapsed * 0.42) * 4.35,
      Math.sin(elapsed * 0.42) * 0.85,
      Math.sin(elapsed * 0.42) * 4.35,
    );
    satellite.rotation.y += dt * 0.25;
  }

  renderer.render(scene, camera);
}

updateSatellite();
requestAnimationFrame(animate);
$('sceneLoading').remove();

for (const element of designControls) {
  element.addEventListener('input', refresh);
}
runButton.addEventListener('click', startMission);

resetButton.addEventListener('click', () => {
  rocketSelect.value = 'standard';
  cameraSelect.value = 'medium';
  panelSelect.value = 'medium';
  antennaSelect.value = 'standard';
  budgetInput.value = '100';

  simulationRunning = false;
  setDesignLocked(false);
  elapsed = 0;
  phaseElapsed = 0;
  phaseIndex = 0;
  hudUpdateAccumulator = 0;
  batteryLevel = MAX_BATTERY;
  dataCollected = 0;
  dataTransmitted = 0;
  orbitAngle = 0;
  scienceScore = 0;
  sciencePowerFailure = false;
  downlinkPowerFailure = false;

  satellite.position.set(4.35, 0, 0);
  satellite.rotation.set(0, 0, 0);
  setText('elapsed', '00:00');

  const pill = $('statusPill');
  pill.classList.remove('status-running', 'status-danger', 'status-warning');

  refresh();
  updateMissionHud();
});

refresh();
updateMissionHud();


