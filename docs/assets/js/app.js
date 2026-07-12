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
    if (href.startsWith("#") && !href.startsWith("#/")) {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        const target = document.getElementById(href.slice(1));
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
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

/* ------------------------------------------------------------
   週次チェックリスト（ジムページ限定・localStorage 保存）
   終わったパターンにチェックを入れると保存され、毎週月曜0:00に自動リセット。
   ------------------------------------------------------------ */
const CHECK_STORE_KEY = "gymWeekChecks";
const CHECK_WEEK_KEY = "gymWeekStart";

function currentMondayKey() {
  const now = new Date();
  const day = now.getDay();               // 0=日 … 6=土
  const back = day === 0 ? 6 : day - 1;   // 月曜からの経過日数（日曜は前週月曜へ）
  const m = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
  const pad = (n) => String(n).padStart(2, "0");
  return `${m.getFullYear()}-${pad(m.getMonth() + 1)}-${pad(m.getDate())}`;
}

function loadWeekChecks() {
  const week = currentMondayKey();
  try {
    if (localStorage.getItem(CHECK_WEEK_KEY) !== week) {
      // 週が変わった → 全リセット（月曜0:00リセット）
      localStorage.setItem(CHECK_WEEK_KEY, week);
      localStorage.setItem(CHECK_STORE_KEY, "{}");
      return {};
    }
    return JSON.parse(localStorage.getItem(CHECK_STORE_KEY) || "{}");
  } catch (_) {
    return {};
  }
}

function saveWeekChecks(state) {
  try {
    localStorage.setItem(CHECK_STORE_KEY, JSON.stringify(state));
  } catch (_) {
    /* localStorage 不可の環境では保存をあきらめる（表示は動く） */
  }
}

function updateWeekProgress(boxes) {
  const list = boxes[0].closest("ul");
  if (!list) return;
  const done = boxes.filter((b) => b.checked).length;
  let el = document.querySelector(".week-progress");
  if (!el) {
    el = document.createElement("p");
    el.className = "week-progress";
    list.parentNode.insertBefore(el, list);
  }
  el.innerHTML =
    `今週の進捗: ${done} / ${boxes.length} 完了　` +
    `<small>毎週月曜0:00にリセット</small>`;
}

function enhanceGymChecklist(rootEl) {
  const boxes = Array.from(rootEl.querySelectorAll('input[type="checkbox"]'));
  if (!boxes.length) return;

  const state = loadWeekChecks();
  const firstList = boxes[0].closest("ul");
  if (firstList) firstList.classList.add("week-menu");

  boxes.forEach((box) => {
    const li = box.closest("li");
    const key = (li ? li.textContent : box.value || "").trim();
    box.disabled = false;               // marked は disabled で出すため解除
    box.classList.add("interactive");
    if (state[key]) box.checked = true;
    box.addEventListener("change", () => {
      state[key] = box.checked;
      saveWeekChecks(state);
      updateWeekProgress(boxes);
    });
  });

  updateWeekProgress(boxes);
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
    if (section.id === "gym") enhanceGymChecklist(container);
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
