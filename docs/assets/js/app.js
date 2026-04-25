/* ============================================================
   Training Notes — client-side router & markdown renderer
   ============================================================ */

const SECTIONS = [
  { id: "issues",    label: "課題",       icon: "🎯", file: "./content/issues.md" },
  { id: "gym",       label: "ジム",       icon: "🏋️", file: "./content/menu/gym.md" },
  { id: "home",      label: "自宅",       icon: "🏠", file: "./content/menu/home.md" },
  { id: "stretch",   label: "ストレッチ", icon: "🤸", file: "./content/menu/stretch.md" },
  { id: "lifestyle", label: "生活",       icon: "🌿", file: "./content/menu/lifestyle.md" },
];

const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
const DEFAULT_SECTION = "issues";

const LINK_MAP = {
  "home.md": "home",
  "stretch.md": "stretch",
  "gym.md": "gym",
  "lifestyle.md": "lifestyle",
  "issues.md": "issues",
};

const markdownCache = new Map();

function configureMarked() {
  if (typeof marked === "undefined") return;
  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: true,
    mangle: false,
  });
}

function buildNav() {
  const top = document.getElementById("topNav");
  const bottom = document.getElementById("bottomNav");

  for (const s of SECTIONS) {
    const topItem = document.createElement("li");
    topItem.innerHTML = `
      <button type="button" class="top-nav__btn" data-section="${s.id}">
        <span>${s.label}</span>
      </button>`;
    top.appendChild(topItem);

    const bottomItem = document.createElement("li");
    bottomItem.innerHTML = `
      <button type="button" class="bottom-nav__btn" data-section="${s.id}">
        <span class="bottom-nav__icon" aria-hidden="true">${s.icon}</span>
        <span class="bottom-nav__label">${s.label}</span>
      </button>`;
    bottom.appendChild(bottomItem);
  }

  document.querySelectorAll("[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-section");
      navigate(id, { push: true });
    });
  });
}

function setActiveNav(id) {
  document.querySelectorAll("[data-section]").forEach((btn) => {
    if (btn.getAttribute("data-section") === id) {
      btn.setAttribute("aria-current", "page");
    } else {
      btn.removeAttribute("aria-current");
    }
  });
}

async function loadMarkdown(section) {
  if (markdownCache.has(section.id)) {
    return markdownCache.get(section.id);
  }
  const res = await fetch(section.file, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} — ${section.file}`);
  }
  const text = await res.text();
  markdownCache.set(section.id, text);
  return text;
}

function renderMarkdown(md) {
  const html = marked.parse(md);
  return html
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>');
}

function rewriteInternalLinks(rootEl) {
  rootEl.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href) return;
    const cleaned = href.replace(/^\.\//, "").split("#")[0];
    if (LINK_MAP[cleaned]) {
      a.setAttribute("href", `#/${LINK_MAP[cleaned]}`);
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        navigate(LINK_MAP[cleaned], { push: true });
      });
    } else if (/^https?:\/\//.test(href)) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    }
  });
}

async function navigate(sectionId, { push = false } = {}) {
  const section = SECTION_BY_ID[sectionId] || SECTION_BY_ID[DEFAULT_SECTION];
  setActiveNav(section.id);

  const container = document.getElementById("content");
  container.innerHTML = '<div class="loading">読み込み中…</div>';

  try {
    const md = await loadMarkdown(section);
    container.innerHTML = renderMarkdown(md);
    rewriteInternalLinks(container);
    document.title = `${section.label} | Training Notes`;
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="error">
        <strong>読み込みに失敗しました。</strong><br>
        ${section.file} を取得できませんでした（${err.message}）。<br>
        ローカルで開いている場合は <code>file://</code> ではなくローカルサーバー経由で開いてください。
      </div>`;
  }

  if (push) {
    history.pushState({ section: section.id }, "", `#/${section.id}`);
  }
}

function getSectionFromHash() {
  const m = location.hash.match(/^#\/([^/?#]+)/);
  return m ? m[1] : DEFAULT_SECTION;
}

function init() {
  configureMarked();
  buildNav();

  window.addEventListener("hashchange", () => {
    navigate(getSectionFromHash(), { push: false });
  });
  window.addEventListener("popstate", () => {
    navigate(getSectionFromHash(), { push: false });
  });

  navigate(getSectionFromHash(), { push: false });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
