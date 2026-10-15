// Tiny lightbox: window.openPreview([{ src, caption }], startIndex)
// Esc / click outside / ✕ closes, ← → switch between images.
(() => {
  let box, img, cap, list = [], idx = 0;
  function build() {
    box = document.createElement("div");
    box.className = "lb";
    box.innerHTML = `<button class="lb-btn lb-close" type="button" aria-label="Close">✕</button>
      <button class="lb-btn lb-prev" type="button" aria-label="Previous">‹</button>
      <figure><img alt="" /><figcaption></figcaption></figure>
      <button class="lb-btn lb-next" type="button" aria-label="Next">›</button>`;
    img = box.querySelector("img");
    cap = box.querySelector("figcaption");
    box.onclick = (e) => {
      if (e.target.closest(".lb-prev")) return show(idx - 1);
      if (e.target.closest(".lb-next")) return show(idx + 1);
      if (e.target === img) return;
      close();
    };
    document.body.append(box);
  }
  function show(i) {
    if (!list.length) return;
    idx = (i + list.length) % list.length;
    img.src = list[idx].src;
    cap.textContent = list[idx].caption || "";
    box.classList.toggle("lb-single", list.length < 2);
  }
  function close() {
    box.classList.remove("open");
    document.body.style.overflow = "";
    window.removeEventListener("keydown", onKey);
  }
  function onKey(e) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(idx - 1);
    else if (e.key === "ArrowRight") show(idx + 1);
  }
  window.openPreview = (items, start = 0) => {
    if (!box) build();
    list = items;
    show(start);
    box.classList.add("open");
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
  };
})();
