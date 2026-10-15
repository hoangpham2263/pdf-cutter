// PDF Cutter — preview pages, pick the ones to keep and download them. Runs in the browser.
(() => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const TEXT = {
    vi: {
      title: "Cắt PDF",
      subtitle: "Chọn trang cần giữ rồi tải về — chạy ngay trên trình duyệt, file không được tải lên đâu cả.",
      drop: "Kéo thả file PDF vào đây hoặc bấm để chọn",
      dropHint: "Mỗi lần một file PDF. Mẹo: giữ Shift để chọn nhiều trang liền nhau.",
      all: "Chọn tất cả",
      none: "Bỏ chọn",
      invert: "Đảo chọn",
      rangePh: "Hoặc gõ trang, ví dụ: 1-3, 5, 8",
      save: "Tải PDF các trang đã chọn",
      split: "Tách mỗi trang 1 file (ZIP)",
      selected: (n, total) => `Đã chọn ${n}/${total} trang`,
      loading: "Đang mở file…",
      page: "Trang",
      error: "Không mở được file này (file hỏng hoặc có mật khẩu).",
      footer: "Làm bởi",
      switchTo: "EN",
      switchTitle: "English",
      suffix: "da-cat",
      pageSuffix: "trang",
    },
    en: {
      title: "PDF cutter",
      subtitle: "Pick the pages to keep and download them — runs in your browser, nothing is uploaded.",
      drop: "Drop a PDF here or click to choose",
      dropHint: "One PDF at a time. Tip: hold Shift to select a run of pages.",
      all: "Select all",
      none: "Clear",
      invert: "Invert",
      rangePh: "Or type pages, e.g. 1-3, 5, 8",
      save: "Download selected pages",
      split: "One file per page (ZIP)",
      selected: (n, total) => `${n}/${total} pages selected`,
      loading: "Opening file…",
      page: "Page",
      error: "Could not open this file (damaged or password-protected).",
      footer: "Made by",
      switchTo: "VI",
      switchTitle: "Tiếng Việt",
      suffix: "cut",
      pageSuffix: "page",
    },
  };

  const $ = (id) => document.getElementById(id);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  const state = {
    lang: store.get("pc-lang") || (navigator.language.startsWith("vi") ? "vi" : "en"),
    file: null,
    bytes: null,
    total: 0,
    keep: new Set(),
    last: null,
    run: 0,
  };
  const t = (k) => TEXT[state.lang][k];
  const baseName = () => state.file.name.replace(/\.pdf$/i, "");

  function applyLang() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
    $("lang").textContent = t("switchTo");
    $("lang").title = t("switchTitle");
    document.querySelectorAll(".page span").forEach((s, i) => (s.textContent = `${t("page")} ${i + 1}`));
    sync();
  }

  function sync() {
    if (!state.file) return;
    $("summary").textContent = state.total ? t("selected")(state.keep.size, state.total) : t("loading");
    document.querySelectorAll(".page").forEach((el) => el.classList.toggle("on", state.keep.has(Number(el.dataset.i))));
    $("save").disabled = $("split").disabled = state.keep.size === 0;
  }

  async function open(file) {
    const run = ++state.run;
    state.file = file;
    state.total = 0;
    state.keep = new Set();
    state.last = null;
    $("fname").textContent = file.name;
    $("pages").replaceChildren();
    $("range").value = "";
    $("result").hidden = false;
    sync();
    try {
      state.bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjsLib.getDocument({ data: state.bytes.slice() }).promise;
      if (run !== state.run) return;
      state.total = doc.numPages;
      for (let i = 0; i < doc.numPages; i++) state.keep.add(i);
      const cards = [];
      for (let i = 0; i < doc.numPages; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "page on";
        b.dataset.i = i;
        b.innerHTML = `<canvas></canvas><span></span><i class="check">✓</i>`;
        b.querySelector("span").textContent = `${t("page")} ${i + 1}`;
        cards.push(b);
      }
      $("pages").replaceChildren(...cards);
      sync();
      // Render thumbnails one by one so big files stay responsive
      for (let i = 0; i < doc.numPages; i++) {
        if (run !== state.run) return;
        const page = await doc.getPage(i + 1);
        const vp0 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: 240 / vp0.width });
        const canvas = cards[i].querySelector("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp, intent: "print" }).promise; // "print" avoids rAF, so it also runs in background tabs
      }
    } catch (e) {
      console.error(e);
      if (run !== state.run) return;
      $("summary").textContent = t("error");
      $("summary").className = "small warn";
    }
  }

  // "1-3, 5, 8" -> zero-based page indexes
  function parseRange(text) {
    const out = new Set();
    for (const part of text.split(/[,;\s]+/).filter(Boolean)) {
      const m = part.match(/^(\d+)(?:-(\d*))?$/);
      if (!m) continue;
      const a = Number(m[1]);
      const b = m[2] === undefined ? a : m[2] === "" ? state.total : Number(m[2]);
      for (let p = Math.min(a, b); p <= Math.max(a, b); p++) if (p >= 1 && p <= state.total) out.add(p - 1);
    }
    return out;
  }

  const sorted = () => [...state.keep].sort((a, b) => a - b);

  async function build(indexes) {
    const { PDFDocument } = PDFLib;
    const src = await PDFDocument.load(state.bytes, { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indexes);
    pages.forEach((p) => out.addPage(p));
    return out.save();
  }

  function saveBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  async function busy(btn, fn) {
    btn.disabled = true;
    try { await fn(); } catch (e) { console.error(e); alert(t("error")); }
    sync();
  }

  // Events
  $("drop").onclick = () => $("file").click();
  $("file").onchange = (e) => {
    if (e.target.files[0]) open(e.target.files[0]);
    e.target.value = "";
  };
  $("drop").ondragover = (e) => { e.preventDefault(); $("drop").classList.add("over"); };
  $("drop").ondragleave = () => $("drop").classList.remove("over");
  $("drop").ondrop = (e) => {
    e.preventDefault();
    $("drop").classList.remove("over");
    const f = [...e.dataTransfer.files].find((x) => /\.pdf$/i.test(x.name) || x.type === "application/pdf");
    if (f) open(f);
  };
  $("pages").onclick = (e) => {
    const el = e.target.closest(".page");
    if (!el) return;
    const i = Number(el.dataset.i);
    if (e.shiftKey && state.last != null) {
      // Shift + click: apply the clicked page's new state to the whole range
      const on = !state.keep.has(i);
      for (let p = Math.min(state.last, i); p <= Math.max(state.last, i); p++) on ? state.keep.add(p) : state.keep.delete(p);
    } else {
      state.keep.has(i) ? state.keep.delete(i) : state.keep.add(i);
    }
    state.last = i;
    $("range").value = "";
    sync();
  };
  // Shift + click should not select text
  $("pages").onmousedown = (e) => e.shiftKey && e.preventDefault();
  // Keyboard: Ctrl/Cmd + A select all, Ctrl/Cmd + I invert, Esc clear, Ctrl/Cmd + S download
  window.addEventListener("keydown", (e) => {
    if (!state.total || e.target.closest?.("input")) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (mod && key === "a") $("all").click();
    else if (mod && key === "i") $("invert").click();
    else if (mod && key === "s") { if (state.keep.size) $("save").click(); }
    else if (e.key === "Escape") $("none").click();
    else return;
    e.preventDefault();
  });
  $("all").onclick = () => { state.keep = new Set([...Array(state.total).keys()]); sync(); };
  $("none").onclick = () => { state.keep = new Set(); sync(); };
  $("invert").onclick = () => {
    state.keep = new Set([...Array(state.total).keys()].filter((i) => !state.keep.has(i)));
    sync();
  };
  $("range").oninput = (e) => {
    if (!e.target.value.trim()) return;
    state.keep = parseRange(e.target.value);
    sync();
  };
  $("save").onclick = () =>
    busy($("save"), async () => {
      const bytes = await build(sorted());
      saveBlob(new Blob([bytes], { type: "application/pdf" }), `${baseName()}-${t("suffix")}.pdf`);
    });
  $("split").onclick = () =>
    busy($("split"), async () => {
      const entries = {};
      for (const i of sorted()) entries[`${baseName()}-${t("pageSuffix")}-${i + 1}.pdf`] = [await build([i]), { level: 0 }];
      saveBlob(new Blob([fflate.zipSync(entries)], { type: "application/zip" }), `${baseName()}.zip`);
    });
  $("lang").onclick = () => {
    state.lang = state.lang === "vi" ? "en" : "vi";
    store.set("pc-lang", state.lang);
    applyLang();
  };

  applyLang();
})();
