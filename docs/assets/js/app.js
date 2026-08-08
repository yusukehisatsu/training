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
   テーブルのモバイル対応
   スマホ幅では列が潰れて縦長になるため、CSS 側で 1 行 = 1 カード
   （ラベル付きの縦積み）に切り替える。ここではそのために必要な
   data-label（＝見出しセルの文言）を各セルへ付与する。
   あわせて、意識ポイント欄の「／」区切りキューを 1 行ずつ読めるよう
   <span class="cue"> で包む（PC 表示は従来どおり 1 行に並ぶ）。
   ------------------------------------------------------------ */
const CUE_SEPARATOR = "／";

function splitCellCues(cell) {
  if (!cell.textContent.includes(CUE_SEPARATOR)) return;

  const frag = document.createDocumentFragment();
  let cue = document.createElement("span");
  cue.className = "cue";

  const flush = () => {
    if (cue.childNodes.length) frag.appendChild(cue);
    cue = document.createElement("span");
    cue.className = "cue";
  };

  // appendChild は元の親から移動するので、走査前に配列化しておく
  Array.from(cell.childNodes).forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue.includes(CUE_SEPARATOR)) {
      cue.appendChild(node); // appendChild が元の位置から移動してくれる
      return;
    }
    const text = node.nodeValue;
    node.remove(); // 分割後のテキストノードで置き換えるため元のノードは外す
    text.split(CUE_SEPARATOR).forEach((part, i) => {
      if (i > 0) {
        // 区切り文字は直前のキューの末尾に残す（PC 表示を変えないため）
        const sep = document.createElement("span");
        sep.className = "cue__sep";
        sep.textContent = CUE_SEPARATOR;
        cue.appendChild(sep);
        flush();
      }
      if (part) cue.appendChild(document.createTextNode(part));
    });
  });
  flush();

  cell.appendChild(frag);
}

function enhanceTables(rootEl) {
  rootEl.querySelectorAll(".table-wrap > table").forEach((table) => {
    const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
      th.textContent.trim()
    );
    if (!headers.length) return;

    table.classList.add("table--stackable");
    table.parentElement.classList.add("table-wrap--stacked");
    table.querySelectorAll("tbody tr").forEach((tr) => {
      Array.from(tr.children).forEach((cell, i) => {
        if (headers[i]) cell.setAttribute("data-label", headers[i]);
        // 1列目はカード見出しになるので分割しない（「棘上筋（活性／抑制…）」等の誤分割を避ける）
        if (i > 0) splitCellCues(cell);
      });
    });
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
    enhanceTables(container);
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
