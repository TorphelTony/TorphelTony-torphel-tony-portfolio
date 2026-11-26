document.documentElement.classList.add('js');
const menuButton = document.querySelector<HTMLButtonElement>('.menu-toggle')!;
const mobileNav = document.querySelector<HTMLElement>('.mobile-nav')!;
const progressBar = document.querySelector<HTMLElement>('.page-progress span')!;
const percentLabel = document.querySelector<HTMLElement>('#scroll-percent')!;
const railLinks = [...document.querySelectorAll<HTMLAnchorElement>('.chapter-rail a')];
const sceneSections = [...document.querySelectorAll<HTMLElement>('[data-scene]')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open menu');
  mobileNav.hidden = true;
  document.body.classList.remove('menu-open');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  mobileNav.hidden = !open;
  document.body.classList.toggle('menu-open', open);
});
mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});
document.querySelector<HTMLElement>('#year')!.textContent = String(new Date().getFullYear());

let scrollProgress = 0;
let activeScene = 0;
function updateScrollState() {
  const range = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  scrollProgress = Math.min(1, Math.max(0, scrollY / range));
  progressBar.style.width = `${Math.round(scrollProgress * 100)}%`;
  percentLabel.textContent = String(Math.round(scrollProgress * 100)).padStart(2, '0');
  const viewportCenter = innerHeight * 0.48;
  let closest = Infinity;
  for (const section of sceneSections) {
    const rect = section.getBoundingClientRect();
    const distance = Math.abs(rect.top + Math.min(rect.height, innerHeight) / 2 - viewportCenter);
    if (distance < closest) {
      closest = distance;
      activeScene = Number(section.dataset.scene);
    }
  }
  const activeId = sceneSections.find(
    (section) => Number(section.dataset.scene) === activeScene,
  )?.id;
  railLinks.forEach((link) => {
    if (link.getAttribute('href') === `#${activeId}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  if (reducedMotion) drawWorld(0);
}
window.addEventListener('scroll', updateScrollState, { passive: true });
window.addEventListener('resize', updateScrollState);

if (reducedMotion || !('IntersectionObserver' in window)) {
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el));
}

if (!reducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll<HTMLElement>('.project-card').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty('--tilt-y', `${(x * 7).toFixed(2)}deg`);
      card.style.setProperty('--tilt-x', `${(-y * 7).toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    });
  });
}

// A small procedural 3D scene: an icosahedral core and orbiting paths projected
// into a canvas. Scroll position controls its orientation and perspective.
const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const ctx = canvas.getContext('2d', { alpha: true });
let viewWidth = 0,
  viewHeight = 0,
  dpr = 1;
let pointerX = 0,
  pointerY = 0;
let easeX = 0,
  easeY = 0;
const phi = (1 + Math.sqrt(5)) / 2;
type Vec3 = [number, number, number];
const rawVertices: Vec3[] = [
  [-1, phi, 0],
  [1, phi, 0],
  [-1, -phi, 0],
  [1, -phi, 0],
  [0, -1, phi],
  [0, 1, phi],
  [0, -1, -phi],
  [0, 1, -phi],
  [phi, 0, -1],
  [phi, 0, 1],
  [-phi, 0, -1],
  [-phi, 0, 1],
];
const vertices = rawVertices.map((v) => {
  const length = Math.hypot(...v);
  return v.map((value) => (value / length) * 1.25) as Vec3;
});
const edges: [number, number][] = [];
for (let a = 0; a < vertices.length; a++) {
  for (let b = a + 1; b < vertices.length; b++) {
    if (Math.hypot(...vertices[a].map((value, i) => value - vertices[b][i])) < 1.45)
      edges.push([a, b]);
  }
}
const palette = ['#d6ff72', '#a99cff', '#7be4e3', '#d6ff72', '#a9b8ff', '#d6ff72'];
const stars = Array.from({ length: 90 }, (_, index) => {
  const n = index + 1;
  return {
    x: Math.sin(n * 73.21) * 5,
    y: Math.cos(n * 39.17) * 3.5,
    z: 2 + ((n * 0.6180339) % 1) * 8,
    size: n % 9 === 0 ? 1.6 : 0.8,
  };
});
function resizeCanvas() {
  if (!ctx) return;
  dpr = Math.min(devicePixelRatio || 1, 1.6);
  viewWidth = innerWidth;
  viewHeight = innerHeight;
  canvas.width = Math.round(viewWidth * dpr);
  canvas.height = Math.round(viewHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (reducedMotion) drawWorld(0);
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener(
  'pointermove',
  (event) => {
    pointerX = event.clientX / Math.max(1, innerWidth) - 0.5;
    pointerY = event.clientY / Math.max(1, innerHeight) - 0.5;
  },
  { passive: true },
);
function rotate([x, y, z]: Vec3, rx: number, ry: number, rz: number): Vec3 {
  let c = Math.cos(rx),
    s = Math.sin(rx);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ry);
  s = Math.sin(ry);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(rz);
  s = Math.sin(rz);
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}
function drawWorld(time: number) {
  if (!ctx || !viewWidth || !viewHeight) return;
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  easeX += (pointerX - easeX) * 0.045;
  easeY += (pointerY - easeY) * 0.045;
  const accent = palette[activeScene] || palette[0];
  const cx = viewWidth * (viewWidth < 700 ? 0.62 : 0.69);
  const cy = viewHeight * 0.49;
  const unit = Math.min(viewWidth, viewHeight) * (viewWidth < 700 ? 0.39 : 0.34);
  const rx = 0.28 + scrollProgress * Math.PI * 2.3 + easeY * 0.28;
  const ry = 0.48 + scrollProgress * Math.PI * 4.2 + time * 0.00012 + easeX * 0.3;
  const rz = -0.18 + scrollProgress * Math.PI * 0.6;
  const zoom = 1 + Math.sin(scrollProgress * Math.PI * 3) * 0.09;
  const project = (point: Vec3) => {
    const [x, y, z] = rotate(point, rx, ry, rz);
    const depth = 4.6 + z;
    const factor = (3.1 / Math.max(1.5, depth)) * zoom;
    return { x: cx + x * unit * factor, y: cy + y * unit * factor, z, factor };
  };
  const halo = ctx.createRadialGradient(cx, cy, 15, cx, cy, unit * 2.15);
  halo.addColorStop(0, `${accent}23`);
  halo.addColorStop(0.45, `${accent}0b`);
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - unit * 2.2, cy - unit * 2.2, unit * 4.4, unit * 4.4);
  for (const star of stars) {
    const drift = scrollProgress * 90;
    const x = (star.x / 10 + 0.5) * viewWidth + drift * (star.z / 10);
    const y = (star.y / 7 + 0.5) * viewHeight - drift * (star.z / 14);
    ctx.beginPath();
    ctx.fillStyle = `rgba(215,231,245,${0.1 + star.z / 75})`;
    ctx.arc(x % viewWidth, y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  const ring = (radius: number, tilt: number, phase: number, opacity: string) => {
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const angle = (i / 160) * Math.PI * 2 + phase;
      const point = project(
        rotate([Math.cos(angle) * radius, Math.sin(angle) * radius, 0], tilt, phase * 0.22, 0),
      );
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.strokeStyle = `${accent}${opacity}`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  };
  ring(1.83, 0.55, 0.15, '65');
  ring(1.64, 1.24, 1.6, '48');
  ring(1.52, -0.9, 2.5, '35');
  const points = vertices.map(project);
  const orderedEdges = edges
    .map(([a, b]) => ({ a: points[a], b: points[b], z: (points[a].z + points[b].z) / 2 }))
    .sort((a, b) => a.z - b.z);
  for (const edge of orderedEdges) {
    ctx.beginPath();
    ctx.moveTo(edge.a.x, edge.a.y);
    ctx.lineTo(edge.b.x, edge.b.y);
    ctx.strokeStyle = `${accent}${edge.z > 0 ? 'bc' : '5f'}`;
    ctx.lineWidth = edge.z > 0 ? 1.7 : 1;
    ctx.stroke();
  }
  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.z > 0 ? 3.2 : 2.1, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = point.z > 0 ? 14 : 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  const core = ctx.createRadialGradient(cx - unit * 0.08, cy - unit * 0.11, 2, cx, cy, unit * 0.55);
  core.addColorStop(0, '#ffffffdf');
  core.addColorStop(0.1, accent);
  core.addColorStop(0.48, `${accent}91`);
  core.addColorStop(1, `${accent}00`);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, unit * 0.55, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const angle = time * 0.0003 + scrollProgress * 8 + (i * Math.PI * 2) / 5;
    const p = project([Math.cos(angle) * 1.83, Math.sin(angle) * 1.83, 0]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === 0 ? 5 : 2.6, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? '#fff' : accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
function animate(time: number) {
  if (!reducedMotion && !document.hidden) drawWorld(time);
  requestAnimationFrame(animate);
}
if (ctx) {
  resizeCanvas();
  if (reducedMotion) drawWorld(0);
  else requestAnimationFrame(animate);
}
updateScrollState();
