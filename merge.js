// PDF Tools — tabs (Cut / Merge) and the Merge tool: add PDFs, reorder, merge into one file.
(() => {
  const TEXT = {
    vi: {
      tabCut: "Cắt PDF",
      tabMerge: "Gộp PDF",
      drop: "Kéo thả nhiều file PDF vào đây hoặc bấm để chọn",
      dropHint: "Sắp xếp thứ tự bằng ↑ ↓ hoặc kéo thả, rồi gộp thành 1 file.",
      merge: "Gộp và tải PDF",
      clear: "Xóa hết",
      up: "Lên",
      down: "Xuống",
      remove: "Xóa",
      pages: "trang",
      files: "file",
      total: (f, p) => `${f} file · ${p} trang`,
      loading: "Đang đọc…",
      error: "Không mở được (file hỏng hoặc có mật khẩu)",
      merging: "Đang gộp…",
      fileName: "pdf-da-gop",
    },
    en: {
      tabCut: "Cut PDF",
      tabMerge: "Merge PDF",
      drop: "Drop several PDFs here or click to choose",
      dropHint: "Reorder with ↑ ↓ or drag and drop, then merge into one file.",
      merge: "Merge and download",
      clear: "Clear",
      up: "Up",
      down: "Down",
      remove: "Remove",
      pages: "pages",
      files: "files",
      total: (f, p) => `${f} files · ${p} pages`,
      loading: "Reading…",
      error: "Could not open (damaged or password-protected)",
      merging: "Merging…",
      fileName: "merged",
    },
  };

  const $ = (id) => document.getElementById(id);
  const lang = () => (document.documentElement.lang === "en" ? "en" : "vi");
  const t = (k) => TEXT[lang()][k];
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  const items = []; // { file, pages, thumb, error }
  let dragFrom = null;

  // ---------- Tabs ----------
  function showTab(name) {
    $("tab-cut").hidden = name !== "cut";
    $("tab-merge").hidden = name !== "merge";
    [...$("tabs").children].forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on);
    });
    store.set("pt-tab", name);
    if (location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
  }
  $("tabs").onclick = (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) showTab(b.dataset.tab);
  };

  // ---------- Merge ----------
  async function readPdf(item) {
    try {
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await item.file.arrayBuffer()) }).promise;
      item.pages = doc.numPages;
      const page = await doc.getPage(1);
      const vp0 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: 120 / vp0.width });
      const canvas = document.createElement("canvas");
      canvas.width = vp.width;
      canvas.height = vp.height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // "print" avoids requestAnimationFrame, so it also renders in background tabs
      await page.render({ canvasContext: ctx, viewport: vp, intent: "print" }).promise;
      item.thumb = canvas.toDataURL("image/jpeg", 0.8);
    } catch (e) {
      console.error(e);
      item.error = true;
    }
    render();
  }

  function move(from, to) {
    if (to < 0 || to >= items.length || from === to) return;
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it);
    render();
  }

  function render() {
    $("mresult").hidden = items.length === 0;
    const ok = items.filter((i) => !i.error && i.pages);
    const totalPages = ok.reduce((s, i) => s + i.pages, 0);
    $("msummary").textContent = items.some((i) => !i.pages && !i.error) ? t("loading") : t("total")(ok.length, totalPages);
    $("mmerge").disabled = ok.length < 2 || items.some((i) => !i.pages && !i.error);

    $("mlist").replaceChildren(
      ...items.map((item, idx) => {
        const li = document.createElement("li");
        li.draggable = true;
        li.dataset.i = idx;
        const thumb = document.createElement(item.thumb ? "img" : "span");
        if (item.thumb) {
          thumb.src = item.thumb;
          thumb.alt = "";
          thumb.className = "mthumb zoomable";
          thumb.onclick = () => window.openPreview?.([{ src: item.thumb, caption: item.file.name }]);
        } else {
          thumb.className = "badge pdf";
          thumb.textContent = "PDF";
        }
        const num = document.createElement("span");
        num.className = "mnum";
        num.textContent = idx + 1;
        const info = document.createElement("div");
        info.className = "info";
        const name = document.createElement("div");
        name.className = "name";
        name.textContent = item.file.name;
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = item.error ? t("error") : item.pages ? `${item.pages} ${t("pages")}` : t("loading");
        if (item.error) meta.classList.add("warn");
        info.append(name, meta);
        const btns = document.createElement("div");
        btns.className = "row-actions";
        const mk = (label, title, disabled, fn) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "btn-sm btn-icon";
          b.textContent = label;
          b.title = title;
          b.disabled = disabled;
          b.onclick = fn;
          return b;
        };
        btns.append(
          mk("↑", t("up"), idx === 0, () => move(idx, idx - 1)),
          mk("↓", t("down"), idx === items.length - 1, () => move(idx, idx + 1)),
          mk("✕", t("remove"), false, () => {
            items.splice(idx, 1);
            render();
          })
        );
        li.append(num, thumb, info, btns);
        return li;
      })
    );
  }

  // Drag and drop to reorder rows
  $("mlist").addEventListener("dragstart", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    dragFrom = Number(li.dataset.i);
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  $("mlist").addEventListener("dragover", (e) => {
    if (dragFrom === null) return;
    e.preventDefault();
    document.querySelectorAll("#mlist li.over").forEach((x) => x.classList.remove("over"));
    e.target.closest("li")?.classList.add("over");
  });
  $("mlist").addEventListener("drop", (e) => {
    if (dragFrom === null) return;
    e.preventDefault();
    const li = e.target.closest("li");
    if (li) move(dragFrom, Number(li.dataset.i));
    dragFrom = null;
  });
  $("mlist").addEventListener("dragend", () => {
    dragFrom = null;
    render();
  });

  function addFiles(files) {
    const pdfs = [...files].filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    pdfs.forEach((file) => {
      const item = { file };
      items.push(item);
      readPdf(item);
    });
    render();
  }

  async function merge() {
    const btn = $("mmerge");
    btn.disabled = true;
    btn.textContent = t("merging");
    try {
      const { PDFDocument } = PDFLib;
      const out = await PDFDocument.create();
      for (const item of items.filter((i) => !i.error && i.pages)) {
        const src = await PDFDocument.load(new Uint8Array(await item.file.arrayBuffer()), { ignoreEncryption: true });
        (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
      }
      const blob = new Blob([await out.save()], { type: "application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${t("fileName")}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (e) {
      console.error(e);
      alert(t("error"));
    }
    btn.textContent = t("merge");
    render();
  }

  $("mdrop").onclick = () => $("mfile").click();
  $("mfile").onchange = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };
  $("mdrop").ondragover = (e) => {
    e.preventDefault();
    $("mdrop").classList.add("over");
  };
  $("mdrop").ondragleave = () => $("mdrop").classList.remove("over");
  $("mdrop").ondrop = (e) => {
    e.preventDefault();
    $("mdrop").classList.remove("over");
    addFiles(e.dataTransfer.files);
  };
  $("mmerge").onclick = merge;
  $("mclear").onclick = () => {
    items.length = 0;
    render();
  };

  // ---------- Language (follows the page language set by app.js) ----------
  function applyLang() {
    document.querySelectorAll("[data-i18n-tab]").forEach((el) => (el.textContent = t(el.dataset.i18nTab)));
    document.querySelectorAll("[data-m]").forEach((el) => (el.textContent = t(el.dataset.m)));
    render();
  }
  new MutationObserver(applyLang).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  // Start on the tab from the URL (#merge) or the last one used
  const start = location.hash === "#merge" || location.hash === "#cut" ? location.hash.slice(1) : store.get("pt-tab") || "cut";
  showTab(start);
  applyLang();
})();
