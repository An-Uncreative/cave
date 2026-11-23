// Hero: floating 3D browser windows of real projects, plus a live API terminal.
// Each window links to its page. If WebGL or the CDN fails, the static
// screenshots in .hero-fallback stay visible.
import * as THREE from "three";

const container = document.getElementById("hero-visual");
const canvas = document.getElementById("hero-canvas");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const INK = 0x1c1b18;
const BAR_H = 56;

const TERMINAL_LINES = [
  ["$ ", "npm run dev", "#f5f5f7"],
  ["✓ ", "connected to MongoDB", "#34d399"],
  ["✓ ", "redis ready · email worker started", "#34d399"],
  ["POST  ", "/api/orders                201  38ms", "#4f8cff"],
  ["POST  ", "/api/payments/verify       200  112ms", "#4f8cff"],
  ["   ↳ ", "paystack verified · order marked paid", "#9ca3af"],
  ["GET   ", "/api/admin/metrics         200  21ms", "#34d399"],
  ["POST  ", "/api/admin/auth/otp        401  invalid code", "#f87171"],
  ["PATCH ", "/api/admin/settings        403  role not allowed", "#f87171"],
  ["PATCH ", "/api/admin/settings        200  audit logged", "#fbbf24"],
];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Draws a browser frame with the screenshot inside it
function browserTexture(img, label) {
  const W = 1280;
  const H = 800 + BAR_H;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");

  roundRect(ctx, 0, 0, W, H, 22);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#ebe7dc";
  ctx.fillRect(0, 0, W, H);

  ["#f87171", "#fbbf24", "#34d399"].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(30 + i * 26, BAR_H / 2, 8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "rgba(28,27,24,0.07)";
  roundRect(ctx, 130, 12, 520, BAR_H - 24, 16);
  ctx.fill();
  ctx.fillStyle = "rgba(28,27,24,0.6)";
  ctx.font = '22px "JetBrains Mono", monospace';
  ctx.textBaseline = "middle";
  ctx.fillText(label, 150, BAR_H / 2 + 1);

  if (img) {
    // Cover-fit, anchored to the top of the page
    const scale = W / img.width;
    ctx.drawImage(img, 0, BAR_H, W, img.height * scale);
  } else {
    const g = ctx.createLinearGradient(0, BAR_H, W, H);
    g.addColorStop(0, "#fffdf7");
    g.addColorStop(1, "#ece6d6");
    ctx.fillStyle = g;
    ctx.fillRect(0, BAR_H, W, H - BAR_H);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(28,27,24,0.85)";
  ctx.lineWidth = 4;
  roundRect(ctx, 1, 1, W - 2, H - 2, 22);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: W / H };
}

// Terminal that types out request logs on a loop
function createTerminal() {
  const W = 1000;
  const H = 640;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const total = TERMINAL_LINES.reduce((n, [a, b]) => n + a.length + b.length, 0);
  let lastChars = -1;

  function draw(chars) {
    roundRect(ctx, 0, 0, W, H, 22);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#15151d";
    ctx.fillRect(0, 0, W, BAR_H);
    ["#f87171", "#fbbf24", "#34d399"].forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(30 + i * 26, BAR_H / 2, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.font = '22px "JetBrains Mono", monospace';
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(245,245,247,0.55)";
    ctx.fillText("api — logs", 130, BAR_H / 2 + 1);

    let left = chars;
    let y = BAR_H + 44;
    for (const [prefix, text, color] of TERMINAL_LINES) {
      if (left <= 0) break;
      const p = prefix.slice(0, left);
      left -= p.length;
      const t = text.slice(0, Math.max(0, left));
      left -= t.length;
      ctx.fillStyle = color;
      ctx.fillText(p, 32, y);
      ctx.fillStyle = "rgba(245,245,247,0.85)";
      ctx.fillText(t, 32 + ctx.measureText(p).width, y);
      y += 52;
    }
    // Blinking cursor
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      ctx.fillStyle = "#4f8cff";
      ctx.fillRect(32, Math.min(y, H - 40) - 14, 12, 26);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(28,27,24,0.85)";
    ctx.lineWidth = 4;
    roundRect(ctx, 1, 1, W - 2, H - 2, 22);
    ctx.stroke();
    tex.needsUpdate = true;
  }

  return {
    tex,
    aspect: W / H,
    update(t) {
      // ~28 chars/sec, hold the full log for 3s, then restart
      const cycle = total / 28 + 3;
      const chars = reduceMotion ? total : Math.floor((t % cycle) * 28);
      const blink = Math.floor(performance.now() / 500);
      if (chars !== lastChars || blink !== this.blink) {
        draw(chars);
        lastChars = chars;
        this.blink = blink;
      }
    },
  };
}

async function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  await document.fonts.load('22px "JetBrains Mono"').catch(() => {});
  const [lagosImg, trackerImg] = await Promise.all([
    loadImage("assets/img/lagos-bites.png"),
    loadImage("assets/img/tracker.png"),
  ]);

  const terminal = createTerminal();
  const windows = [
    {
      ...browserTexture(trackerImg, "accountability-tracker"),
      width: 3.9,
      pos: [-1.0, 0.95, -1.4],
      rot: [0, 0.22, 0],
      href: "garage.html#tracker",
    },
    {
      ...browserTexture(lagosImg, "lagos-bites"),
      width: 4.2,
      pos: [0.55, 0.15, 0],
      rot: [0, -0.18, 0],
      href: "garage.html#lagos-bites",
    },
    {
      tex: terminal.tex,
      aspect: terminal.aspect,
      width: 2.8,
      pos: [-1.2, -1.35, 1.1],
      rot: [0, 0.15, 0],
      href: "experience.html",
    },
  ];

  const group = new THREE.Group();
  scene.add(group);
  const meshes = windows.map((w, i) => {
    const h = w.width / w.aspect;
    // Soft offset shadow, like paper lifted off the page
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(w.width + 0.12, h + 0.12),
      new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0 }),
    );
    shadow.position.set(0.12, -0.14, -0.02);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w.width, h),
      new THREE.MeshBasicMaterial({ map: w.tex, transparent: true }),
    );
    const holder = new THREE.Group();
    holder.add(shadow, mesh);
    holder.position.set(...w.pos);
    holder.rotation.set(...w.rot);
    holder.userData = { href: w.href, base: w.pos[1], phase: i * 2.1, shadow, hover: 0 };
    mesh.userData.holder = holder;
    group.add(holder);
    return mesh;
  });

  // Fit the arrangement to the container, whatever its shape
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visW = visH * camera.aspect;
    group.scale.setScalar(Math.min(visW / 6.6, visH / 5.4, 1.15));
  }
  window.addEventListener("resize", resize);
  resize();

  // Pointer: parallax over the whole page, hover/click on the windows
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const ndc = new THREE.Vector2(9, 9);
  const raycaster = new THREE.Raycaster();
  let hovered = null;

  window.addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  });
  canvas.addEventListener("pointerleave", () => ndc.set(9, 9));
  canvas.addEventListener("click", () => {
    if (hovered) window.location.href = hovered.userData.href;
  });

  // Only render while the hero is on screen
  let visible = true;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(container);

  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    const t = reduceMotion ? 0 : clock.getElapsedTime();

    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    group.rotation.y = mouse.x * 0.22;
    group.rotation.x = -mouse.y * 0.12;

    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(meshes)[0];
    hovered = hit ? hit.object.userData.holder : null;
    canvas.classList.toggle("hovering", !!hovered);

    group.children.forEach((holder) => {
      const d = holder.userData;
      d.hover += ((holder === hovered ? 1 : 0) - d.hover) * 0.12;
      holder.position.y = d.base + Math.sin(t * 0.8 + d.phase) * 0.08;
      holder.scale.setScalar(1 + d.hover * 0.05);
      d.shadow.material.opacity = 0.14 + d.hover * 0.08;
      d.shadow.position.set(0.12 + d.hover * 0.1, -0.14 - d.hover * 0.1, -0.02);
    });

    terminal.update(t);
    renderer.render(scene, camera);
  }
  tick();
  container.classList.add("is-3d");
}

init().catch((err) => console.warn("3D hero disabled:", err));
