const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;

function setupNav() {
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-menu");

  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  // Close the mobile menu after picking a link
  menu.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      menu.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 10);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// Animate sections in once as they enter the viewport
function setupReveal() {
  const els = document.querySelectorAll(".reveal, .reveal-child");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    // Trigger on any overlap so very tall blocks on phones still reveal
    { threshold: 0, rootMargin: "0px 0px -10% 0px" },
  );
  els.forEach((el) => observer.observe(el));
}

// Taped project screenshots tilt towards the cursor like paper being picked up
function setupTilt() {
  if (reduceMotion || !finePointer) return;
  document.querySelectorAll(".tilt").forEach((el) => {
    const target = el.querySelector(".shot");
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      target.style.setProperty("--ry", `${(x - 0.5) * 10}deg`);
      target.style.setProperty("--rx", `${(0.5 - y) * 8}deg`);
    });
    el.addEventListener("pointerleave", () => {
      ["--rx", "--ry"].forEach((p) => target.style.setProperty(p, "0deg"));
    });
  });
}

// Scroll story: database, API and UI layers drop in, then snap together
function setupProcess() {
  const section = document.querySelector(".process");
  if (!section) return;
  const stack = section.querySelector(".stack");
  const layers = [...section.querySelectorAll(".layer")];
  const steps = [...section.querySelectorAll(".process-steps li")];
  const clamp = (v) => Math.min(1, Math.max(0, v));

  function update() {
    // Tighter spacing on phones so the exploded stack doesn't overlap the text
    const GAP = window.innerWidth < 720 ? 50 : 90;
    const DROP = window.innerWidth < 720 ? 90 : 160;
    const r = section.getBoundingClientRect();
    const p = reduceMotion ? 0.7 : clamp(-r.top / (r.height - window.innerHeight));
    const assemble = clamp((p - 0.78) / 0.17);

    layers.forEach((layer, i) => {
      const appear = reduceMotion ? 1 : clamp((p - i * 0.24) / 0.18);
      const z = i * GAP * (1 - assemble) + (1 - appear) * DROP;
      layer.style.transform = `translateZ(${z}px)`;
      layer.style.opacity = appear;
    });

    stack.style.setProperty("--rx", `${55 * (1 - assemble * 0.85)}deg`);
    stack.style.setProperty("--rz", `${-35 * (1 - assemble)}deg`);

    const active = p < 0.26 ? 0 : p < 0.5 ? 1 : 2;
    steps.forEach((s, i) => s.classList.toggle("active", i === active));
    section.classList.toggle("assembled", assemble > 0.95);
  }

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    },
    { passive: true },
  );
  window.addEventListener("resize", update);
  update();
}

// Tech strip: clone the list until it overflows the screen, then scroll by
// exactly one list width so the loop has no visible seam or jump
function setupMarquee() {
  const track = document.querySelector(".stack-track");
  if (!track) return;
  const items = [...track.children];

  function fill() {
    track.querySelectorAll("[data-clone]").forEach((n) => n.remove());
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const setWidth = items.reduce((w, el) => w + el.offsetWidth + gap, 0);
    const copies = Math.ceil(window.innerWidth / setWidth) + 1;
    for (let c = 0; c < copies; c++) {
      items.forEach((el) => {
        const clone = el.cloneNode(true);
        clone.dataset.clone = "";
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      });
    }
    track.style.setProperty("--shift", `${setWidth}px`);
    track.style.setProperty("--duration", `${setWidth / (reduceMotion ? 20 : 45)}s`);
  }

  fill();
  document.fonts.ready.then(fill);
  window.addEventListener("resize", fill);
}

setupNav();
setupReveal();
setupTilt();
setupProcess();
setupMarquee();
// Hello to anyone who opens devtools
console.log(
  "%chi \u{1F44B}%c\nyou're inspecting my site, so you're my kind of person.\nsay hi: oluwatiseerinle@gmail.com\n(the source is plain HTML, CSS and JS. no framework, no build step.)",
  "font: 700 22px 'Caveat', cursive; color: #2a55c0;",
  "font: 13px/1.6 'JetBrains Mono', monospace; color: #5f5b52;",
);

document.querySelectorAll(".year").forEach((el) => {
  el.textContent = new Date().getFullYear();
});
