/*!
 * Copied from https://recoding.cloud/js/recoding-file-picker.js (reCoding platform).
 * Local changes for a CROSS-ORIGIN app: every request goes through rcFetch(),
 * which prefixes the reCoding apiBase and sends the Bearer token received via
 * postMessage (see the inline bridge in index.html). The exam-lockdown probe
 * uses an endpoint the token cannot reach, so it is treated as "not in exam".
 */
/*!
 * reCoding File Picker — componente standard per browsing/salvataggio file
 *
 * API:
 *   RecodingFilePicker.saveAs(opts) -> Promise<{ path, name, dir, format } | null>
 *   RecodingFilePicker.open(opts)   -> Promise<{ path, name, dir } | null>
 *   RecodingFilePicker.pickFolder(opts) -> Promise<{ dir } | null>
 *
 * Opzioni comuni:
 *   title          string  Titolo modal
 *   defaultDir     string  Path iniziale relativo alla home (es. "documenti")
 *   extensions     [str]   Estensioni accettate per filtro (senza punto, solo per open())
 *   showSize       bool    Mostra dimensione file (solo open(), default false)
 *
 * saveAs aggiunge:
 *   defaultName    string  Nome file pre-compilato
 *   forceExtension string  Se settata, forza l'estensione finale
 *   formats        [{value,label,ext}]  Mostra selettore formato
 *   defaultFormat  string  value del formato di default
 *   showDownload   bool    Mostra anche pulsante "Scarica" (richiede onDownload).
 *                          Forzato a false durante lockdown verifica.
 *   lockdownAware  bool    Default true. In verifica nasconde "Scarica" anche se richiesto.
 *
 * Tutte le API tornano una Promise che si risolve con i campi scelti, o `null` se annullato.
 *
 * Tutte le richieste passano dalle API filesystem reCoding (/api/files/*).
 * Documentazione completa: docs/filebrowsing-api.md
 */
(function (global) {
  "use strict";

  if (global.RecodingFilePicker) return; // idempotente

  // ===== CSS injection =====
  const STYLE_ID = "rc-file-picker-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .rc-fp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999000; display: flex; align-items: center; justify-content: center; font-family: 'Segoe UI', system-ui, sans-serif; animation: rc-fp-fadein .15s ease; }
      @keyframes rc-fp-fadein { from { opacity: 0; } to { opacity: 1; } }
      .rc-fp-modal { background: #1e1e24; border: 1px solid #2e2e38; border-radius: 12px; padding: 0; width: 92%; max-width: 520px; max-height: 88vh; display: flex; flex-direction: column; color: #e4e4e8; box-shadow: 0 20px 60px rgba(0,0,0,.5); overflow: hidden; }
      .rc-fp-body { padding: 20px 22px 12px; overflow-y: auto; flex: 1 1 auto; min-height: 0; }
      .rc-fp-body::-webkit-scrollbar { width: 6px; }
      .rc-fp-body::-webkit-scrollbar-thumb { background: #2e2e38; border-radius: 3px; }
      .rc-fp-footer { padding: 12px 22px 16px; border-top: 1px solid #2e2e38; background: #1a1a20; flex-shrink: 0; }
      .rc-fp-modal h3 { margin: 0 0 14px; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; color: #fff; }
      .rc-fp-modal h3 .rc-fp-icon { font-size: 18px; }
      .rc-fp-label { font-size: 12px; color: #8a8a9a; display: block; margin: 0 0 4px; text-transform: uppercase; letter-spacing: .4px; }
      .rc-fp-path { font-size: 12px; color: #8a8a9a; margin: 0 0 8px; padding: 6px 10px; background: #14141a; border: 1px solid #2e2e38; border-radius: 6px; font-family: 'Cascadia Code', 'Consolas', monospace; word-break: break-all; }
      .rc-fp-browser { background: #0d0d12; border: 1px solid #2e2e38; border-radius: 8px; height: 240px; overflow-y: auto; margin-bottom: 12px; }
      .rc-fp-browser::-webkit-scrollbar { width: 6px; }
      .rc-fp-browser::-webkit-scrollbar-thumb { background: #2e2e38; border-radius: 3px; }
      .rc-fp-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; font-size: 13px; color: #b8b8c4; transition: background .1s, color .1s; user-select: none; }
      .rc-fp-item:hover { background: rgba(255,255,255,.04); color: #fff; }
      .rc-fp-item.active { background: rgba(168,92,255,.16); color: #c280ff; }
      .rc-fp-item.dimmed { opacity: 0.55; cursor: default; }
      .rc-fp-item .rc-fp-iicon { font-size: 14px; flex-shrink: 0; }
      .rc-fp-item .rc-fp-iname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rc-fp-item .rc-fp-isize { font-size: 11px; color: #6a6a78; flex-shrink: 0; margin-left: 8px; }
      .rc-fp-empty { padding: 16px; color: #5a5a6a; font-size: 12px; text-align: center; font-style: italic; }
      .rc-fp-error { padding: 12px; color: #f48771; font-size: 12px; text-align: center; }
      .rc-fp-input { width: 100%; background: #14141a; color: #e4e4e8; border: 1px solid #2e2e38; border-radius: 6px; padding: 9px 12px; font-size: 14px; font-family: inherit; outline: none; box-sizing: border-box; margin-bottom: 10px; }
      .rc-fp-input:focus { border-color: #a85cff; }
      .rc-fp-row { display: flex; gap: 6px; align-items: center; margin-bottom: 10px; }
      .rc-fp-row .rc-fp-input { margin-bottom: 0; }
      .rc-fp-formats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
      .rc-fp-formats label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #b8b8c4; cursor: pointer; }
      .rc-fp-formats input { accent-color: #a85cff; }
      .rc-fp-buttons { display: flex; gap: 8px; justify-content: flex-end; margin: 0; flex-wrap: wrap; }
      .rc-fp-btn { padding: 8px 16px; border-radius: 6px; border: 1px solid transparent; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background .15s, border-color .15s; }
      .rc-fp-btn.cancel { background: transparent; color: #8a8a9a; border-color: #2e2e38; }
      .rc-fp-btn.cancel:hover { background: rgba(255,255,255,.04); color: #e4e4e8; border-color: #4a4a5a; }
      .rc-fp-btn.secondary { background: #2e2e38; color: #e4e4e8; }
      .rc-fp-btn.secondary:hover { background: #3a3a48; }
      .rc-fp-btn.primary { background: #a85cff; color: #fff; }
      .rc-fp-btn.primary:hover { background: #c280ff; }
      .rc-fp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .rc-fp-newfolder { display: flex; gap: 6px; margin-bottom: 10px; }
      .rc-fp-newfolder input { flex: 1; }
      .rc-fp-toolbar { display: flex; gap: 6px; margin-bottom: 8px; }
      .rc-fp-toolbar .rc-fp-btn { padding: 6px 10px; font-size: 12px; }
    `;
    document.head.appendChild(style);
  }

  // ===== Helpers =====
  function escAttr(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;"); }
  function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function sanitizeFileName(name) {
    if (!name) return "";
    return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim();
  }

  function applyForcedExtension(name, ext) {
    if (!ext) return name;
    const re = new RegExp("\\." + ext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
    if (re.test(name)) return name;
    return name + "." + ext.replace(/^\./, "");
  }

  function joinPath(dir, name) {
    if (!dir) return name;
    if (dir.endsWith("/")) return dir + name;
    return dir + "/" + name;
  }

  function parentOf(path) {
    if (!path) return "";
    if (!path.includes("/")) return "";
    return path.substring(0, path.lastIndexOf("/"));
  }

  // ===== API filesystem (cross-origin: apiBase + Bearer token) =====
  function rcFetch(path, options) {
    const p = global.rcPlatform || {};
    if (!p.connected) return Promise.reject(new Error("Non collegato a reCoding"));
    options = options || {};
    options.headers = Object.assign({ Authorization: "Bearer " + p.token }, options.headers || {});
    return fetch(p.apiBase + path, options);
  }
  global.rcFetch = rcFetch;

  async function apiList(path) {
    const r = await rcFetch("/api/files/list?path=" + encodeURIComponent(path || ""));
    if (!r.ok) throw new Error("Errore caricamento cartelle (" + r.status + ")");
    return r.json();
  }

  async function apiMkdir(parentPath, name) {
    const r = await rcFetch("/api/files/mkdir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: parentPath || "", name }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || "Errore creazione cartella");
    }
    return r.json();
  }

  // Stato verifica condiviso con file-explorer (cache 30s)
  function getVerificaState() {
    if (typeof global.__rcVerificaState === "function") return global.__rcVerificaState();
    // The filesystem token has no access to /api/verifiche: assume no lockdown.
    return Promise.resolve({ inVerifica: false, data: null });
  }

  // ===== Modal core =====
  function buildModal(opts) {
    injectStyle();
    const overlay = document.createElement("div");
    overlay.className = "rc-fp-overlay";
    const modal = document.createElement("div");
    modal.className = "rc-fp-modal";
    overlay.appendChild(modal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay && opts.dismissOnBackdrop !== false) close(null); });

    let resolveFn;
    const promise = new Promise((res) => { resolveFn = res; });

    function close(result) {
      try { document.body.removeChild(overlay); } catch (e) {}
      document.removeEventListener("keydown", keyHandler);
      resolveFn(result);
    }
    function keyHandler(e) {
      if (e.key === "Escape") close(null);
    }
    document.addEventListener("keydown", keyHandler);

    document.body.appendChild(overlay);
    return { overlay, modal, close, promise };
  }

  // ===== Browser cartelle (solo dir) =====
  function makeFolderBrowser(initialPath, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "rc-fp-browser";
    let current = initialPath || "";

    async function load(path) {
      current = path || "";
      wrap.innerHTML = '<div class="rc-fp-empty">Caricamento...</div>';
      if (onChange) onChange(current);
      try {
        const items = await apiList(current);
        const dirs = items.filter((f) => f.isDirectory && !f.virtual)
          .sort((a, b) => a.name.localeCompare(b.name, "it"));
        wrap.innerHTML = "";
        if (current) {
          const up = document.createElement("div");
          up.className = "rc-fp-item";
          up.innerHTML = '<span class="rc-fp-iicon">&#11176;</span><span class="rc-fp-iname">..</span>';
          up.addEventListener("click", () => load(parentOf(current)));
          wrap.appendChild(up);
        }
        if (!dirs.length && !current) {
          wrap.appendChild(emptyMsg("Nessuna cartella. Il file verra' salvato nella home."));
        } else if (!dirs.length) {
          wrap.appendChild(emptyMsg("Cartella vuota"));
        }
        dirs.forEach((d) => {
          const fullPath = joinPath(current, d.name);
          const it = document.createElement("div");
          it.className = "rc-fp-item";
          it.innerHTML = '<span class="rc-fp-iicon">&#128193;</span><span class="rc-fp-iname"></span>';
          it.querySelector(".rc-fp-iname").textContent = d.name;
          it.addEventListener("click", () => load(fullPath));
          wrap.appendChild(it);
        });
      } catch (e) {
        wrap.innerHTML = '<div class="rc-fp-error">' + escHtml(e.message) + "</div>";
      }
    }

    function emptyMsg(t) {
      const el = document.createElement("div");
      el.className = "rc-fp-empty";
      el.textContent = t;
      return el;
    }

    load(current);

    return {
      el: wrap,
      getPath: () => current,
      reload: () => load(current),
      navigate: (p) => load(p || ""),
    };
  }

  function formatBytes(n) {
    if (n == null || isNaN(n)) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MB";
    return (n / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  // ===== Browser cartelle + file (per open) =====
  function makeFileBrowser(initialPath, exts, onChange, onPick, showSize) {
    const wrap = document.createElement("div");
    wrap.className = "rc-fp-browser";
    let current = initialPath || "";
    const extSet = exts && exts.length ? new Set(exts.map((e) => String(e).toLowerCase().replace(/^\./, ""))) : null;

    async function load(path) {
      current = path || "";
      wrap.innerHTML = '<div class="rc-fp-empty">Caricamento...</div>';
      if (onChange) onChange(current);
      try {
        const items = await apiList(current);
        wrap.innerHTML = "";
        if (current) {
          const up = document.createElement("div");
          up.className = "rc-fp-item";
          up.innerHTML = '<span class="rc-fp-iicon">&#11176;</span><span class="rc-fp-iname">..</span>';
          up.addEventListener("click", () => load(parentOf(current)));
          wrap.appendChild(up);
        }
        const dirs = items.filter((f) => f.isDirectory && !f.virtual).sort((a, b) => a.name.localeCompare(b.name, "it"));
        const files = items.filter((f) => !f.isDirectory && !f.virtual)
          .filter((f) => {
            if (!extSet) return true;
            const e = f.name.includes(".") ? f.name.split(".").pop().toLowerCase() : "";
            return extSet.has(e);
          })
          .sort((a, b) => a.name.localeCompare(b.name, "it"));

        dirs.forEach((d) => {
          const fullPath = joinPath(current, d.name);
          const it = document.createElement("div");
          it.className = "rc-fp-item";
          it.innerHTML = '<span class="rc-fp-iicon">&#128193;</span><span class="rc-fp-iname"></span>';
          it.querySelector(".rc-fp-iname").textContent = d.name;
          it.addEventListener("click", () => load(fullPath));
          wrap.appendChild(it);
        });
        files.forEach((f) => {
          const fullPath = joinPath(current, f.name);
          const it = document.createElement("div");
          it.className = "rc-fp-item";
          let html = '<span class="rc-fp-iicon">&#128196;</span><span class="rc-fp-iname"></span>';
          if (showSize) html += '<span class="rc-fp-isize"></span>';
          it.innerHTML = html;
          it.querySelector(".rc-fp-iname").textContent = f.name;
          if (showSize) it.querySelector(".rc-fp-isize").textContent = formatBytes(f.size);
          it.addEventListener("click", () => {
            wrap.querySelectorAll(".rc-fp-item.active").forEach((x) => x.classList.remove("active"));
            it.classList.add("active");
            if (onPick) onPick(fullPath, f.name, false, f);
          });
          it.addEventListener("dblclick", () => {
            if (onPick) onPick(fullPath, f.name, true, f);
          });
          wrap.appendChild(it);
        });

        if (!dirs.length && !files.length && !current) {
          wrap.appendChild(emptyMsg("Nessun file"));
        } else if (!dirs.length && !files.length) {
          wrap.appendChild(emptyMsg("Cartella vuota"));
        }
      } catch (e) {
        wrap.innerHTML = '<div class="rc-fp-error">' + escHtml(e.message) + "</div>";
      }
    }

    function emptyMsg(t) {
      const el = document.createElement("div");
      el.className = "rc-fp-empty";
      el.textContent = t;
      return el;
    }

    load(current);

    return {
      el: wrap,
      getPath: () => current,
      reload: () => load(current),
      navigate: (p) => load(p || ""),
    };
  }

  // ===== saveAs =====
  function saveAs(opts) {
    opts = opts || {};
    const { overlay, modal, close, promise } = buildModal(opts);

    const title = opts.title || "Salva file";
    modal.innerHTML = `
      <div class="rc-fp-body">
        <h3><span class="rc-fp-icon">&#128190;</span><span class="rc-fp-title-text"></span></h3>
        <span class="rc-fp-label">Salva in reCoding:</span>
        <div class="rc-fp-path"></div>
        <div class="rc-fp-newfolder">
          <input type="text" class="rc-fp-input rc-fp-newfolder-name" placeholder="Nuova cartella..." />
          <button type="button" class="rc-fp-btn secondary rc-fp-newfolder-btn">Crea</button>
        </div>
        <div class="rc-fp-mount-browser"></div>
        <div class="rc-fp-mount-formats"></div>
        <span class="rc-fp-label">Nome file:</span>
        <input type="text" class="rc-fp-input rc-fp-name" />
      </div>
      <div class="rc-fp-footer">
        <div class="rc-fp-buttons">
          <button type="button" class="rc-fp-btn cancel rc-fp-cancel">Annulla</button>
          <button type="button" class="rc-fp-btn secondary rc-fp-download" style="display:none;">Scarica</button>
          <button type="button" class="rc-fp-btn primary rc-fp-save">Salva</button>
        </div>
      </div>
    `;
    modal.querySelector(".rc-fp-title-text").textContent = title;

    const pathEl = modal.querySelector(".rc-fp-path");
    const nameInput = modal.querySelector(".rc-fp-name");
    const newFolderInput = modal.querySelector(".rc-fp-newfolder-name");
    const newFolderBtn = modal.querySelector(".rc-fp-newfolder-btn");
    const browserMount = modal.querySelector(".rc-fp-mount-browser");
    const formatsMount = modal.querySelector(".rc-fp-mount-formats");
    const cancelBtn = modal.querySelector(".rc-fp-cancel");
    const saveBtn = modal.querySelector(".rc-fp-save");
    const downloadBtn = modal.querySelector(".rc-fp-download");

    // Formati
    let currentFormat = opts.defaultFormat || (opts.formats && opts.formats[0] && opts.formats[0].value) || null;
    let formats = opts.formats || null;
    if (formats && formats.length) {
      const fragment = document.createElement("div");
      fragment.className = "rc-fp-formats";
      const lab = document.createElement("span");
      lab.className = "rc-fp-label";
      lab.textContent = "Formato:";
      lab.style.flex = "0 0 100%";
      fragment.appendChild(lab);
      formats.forEach((fmt) => {
        const wrap = document.createElement("label");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "rc-fp-fmt";
        input.value = fmt.value;
        if (fmt.value === currentFormat) input.checked = true;
        input.addEventListener("change", () => {
          currentFormat = fmt.value;
          // Adatta estensione del nome
          const cur = nameInput.value || "";
          const stem = cur.replace(/\.[A-Za-z0-9]+$/, "");
          if (fmt.ext) nameInput.value = stem + (fmt.ext.startsWith(".") ? fmt.ext : "." + fmt.ext);
        });
        wrap.appendChild(input);
        wrap.appendChild(document.createTextNode(" " + fmt.label));
        fragment.appendChild(wrap);
      });
      formatsMount.appendChild(fragment);
    }

    // Browser
    const initialDir = opts.defaultDir || "";
    const browser = makeFolderBrowser(initialDir, (p) => {
      pathEl.textContent = "/" + (p || "");
    });
    browserMount.appendChild(browser.el);

    // Nome di default
    let defaultName = opts.defaultName || "documento.txt";
    if (opts.forceExtension) defaultName = applyForcedExtension(defaultName, opts.forceExtension);
    nameInput.value = defaultName;
    nameInput.addEventListener("focus", () => {
      const v = nameInput.value;
      const dot = v.lastIndexOf(".");
      if (dot > 0) nameInput.setSelectionRange(0, dot);
      else nameInput.select();
    });

    // Nuova cartella
    newFolderBtn.addEventListener("click", async () => {
      const raw = (newFolderInput.value || "").trim();
      const name = sanitizeFileName(raw);
      if (!name) return;
      newFolderBtn.disabled = true;
      try {
        await apiMkdir(browser.getPath(), name);
        newFolderInput.value = "";
        await browser.reload();
        await browser.navigate(joinPath(browser.getPath(), name));
      } catch (e) {
        (window.rcAlert || ((m) => alert(m)))(e.message || "Errore creazione cartella", { title: "Errore" });
      } finally {
        newFolderBtn.disabled = false;
      }
    });
    newFolderInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); newFolderBtn.click(); }
    });

    // Download (se richiesto e non in lockdown)
    const lockdownAware = opts.lockdownAware !== false;
    let inVerifica = false;
    if (lockdownAware) {
      getVerificaState().then((st) => {
        inVerifica = !!st.inVerifica;
        if (inVerifica) downloadBtn.style.display = "none";
      });
    }
    if (opts.showDownload && typeof opts.onDownload === "function") {
      downloadBtn.style.display = "";
      downloadBtn.addEventListener("click", async () => {
        if (inVerifica) return; // safety
        let raw = sanitizeFileName(nameInput.value);
        if (!raw) return;
        if (opts.forceExtension) raw = applyForcedExtension(raw, opts.forceExtension);
        downloadBtn.disabled = true;
        downloadBtn.textContent = "Download...";
        try {
          await opts.onDownload({ name: raw, format: currentFormat, dir: browser.getPath() });
          close({ path: null, name: raw, dir: browser.getPath(), format: currentFormat, action: "download" });
        } catch (e) {
          (window.rcAlert || ((m) => alert(m)))(e.message || "Errore download", { title: "Errore" });
        } finally {
          downloadBtn.disabled = false;
          downloadBtn.textContent = "Scarica";
        }
      });
    }

    // Cancel / Save
    cancelBtn.addEventListener("click", () => close(null));
    saveBtn.addEventListener("click", () => {
      let raw = sanitizeFileName(nameInput.value);
      if (!raw) { nameInput.focus(); return; }
      if (opts.forceExtension) raw = applyForcedExtension(raw, opts.forceExtension);
      const dir = browser.getPath();
      close({ path: joinPath(dir, raw), name: raw, dir, format: currentFormat, action: "save" });
    });
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); saveBtn.click(); }
    });

    setTimeout(() => nameInput.focus(), 80);
    return promise;
  }

  // ===== open =====
  function open(opts) {
    opts = opts || {};
    const { overlay, modal, close, promise } = buildModal(opts);

    const title = opts.title || "Apri file";
    modal.innerHTML = `
      <div class="rc-fp-body">
        <h3><span class="rc-fp-icon">&#128194;</span><span class="rc-fp-title-text"></span></h3>
        <span class="rc-fp-label">Apri da reCoding:</span>
        <div class="rc-fp-path"></div>
        <div class="rc-fp-mount-browser"></div>
      </div>
      <div class="rc-fp-footer">
        <div class="rc-fp-buttons">
          <button type="button" class="rc-fp-btn secondary rc-fp-local" style="display:none;">Dal computer</button>
          <button type="button" class="rc-fp-btn cancel rc-fp-cancel">Annulla</button>
          <button type="button" class="rc-fp-btn primary rc-fp-confirm" disabled>Apri</button>
        </div>
      </div>
    `;
    modal.querySelector(".rc-fp-title-text").textContent = title;

    const pathEl = modal.querySelector(".rc-fp-path");
    const browserMount = modal.querySelector(".rc-fp-mount-browser");
    const cancelBtn = modal.querySelector(".rc-fp-cancel");
    const confirmBtn = modal.querySelector(".rc-fp-confirm");
    // Local change: optional "from this computer" button (browser file dialog).
    const localBtn = modal.querySelector(".rc-fp-local");
    if (typeof opts.onLocal === "function") {
      localBtn.style.display = "";
      localBtn.addEventListener("click", () => { close(null); opts.onLocal(); });
    }

    let selected = null;

    const browser = makeFileBrowser(opts.defaultDir || "", opts.extensions || null, (p) => {
      pathEl.textContent = "/" + (p || "");
      selected = null;
      confirmBtn.disabled = true;
    }, (filePath, fileName, dbl, item) => {
      selected = { path: filePath, name: fileName, dir: parentOf(filePath), item };
      confirmBtn.disabled = false;
      if (dbl) close(selected);
    }, !!opts.showSize);
    browserMount.appendChild(browser.el);

    cancelBtn.addEventListener("click", () => close(null));
    confirmBtn.addEventListener("click", () => { if (selected) close(selected); });

    return promise;
  }

  // ===== pickFolder =====
  function pickFolder(opts) {
    opts = opts || {};
    const { overlay, modal, close, promise } = buildModal(opts);

    const title = opts.title || "Seleziona cartella";
    modal.innerHTML = `
      <div class="rc-fp-body">
        <h3><span class="rc-fp-icon">&#128193;</span><span class="rc-fp-title-text"></span></h3>
        <span class="rc-fp-label">Cartella selezionata:</span>
        <div class="rc-fp-path"></div>
        <div class="rc-fp-newfolder">
          <input type="text" class="rc-fp-input rc-fp-newfolder-name" placeholder="Nuova cartella..." />
          <button type="button" class="rc-fp-btn secondary rc-fp-newfolder-btn">Crea</button>
        </div>
        <div class="rc-fp-mount-browser"></div>
      </div>
      <div class="rc-fp-footer">
        <div class="rc-fp-buttons">
          <button type="button" class="rc-fp-btn cancel rc-fp-cancel">Annulla</button>
          <button type="button" class="rc-fp-btn primary rc-fp-confirm">Seleziona</button>
        </div>
      </div>
    `;
    modal.querySelector(".rc-fp-title-text").textContent = title;

    const pathEl = modal.querySelector(".rc-fp-path");
    const browserMount = modal.querySelector(".rc-fp-mount-browser");
    const newFolderInput = modal.querySelector(".rc-fp-newfolder-name");
    const newFolderBtn = modal.querySelector(".rc-fp-newfolder-btn");
    const cancelBtn = modal.querySelector(".rc-fp-cancel");
    const confirmBtn = modal.querySelector(".rc-fp-confirm");

    const browser = makeFolderBrowser(opts.defaultDir || "", (p) => { pathEl.textContent = "/" + (p || ""); });
    browserMount.appendChild(browser.el);

    newFolderBtn.addEventListener("click", async () => {
      const name = sanitizeFileName((newFolderInput.value || "").trim());
      if (!name) return;
      try {
        await apiMkdir(browser.getPath(), name);
        newFolderInput.value = "";
        await browser.reload();
        await browser.navigate(joinPath(browser.getPath(), name));
      } catch (e) { (window.rcAlert || ((m) => alert(m)))(e.message || "Errore creazione cartella", { title: "Errore" }); }
    });

    cancelBtn.addEventListener("click", () => close(null));
    confirmBtn.addEventListener("click", () => close({ dir: browser.getPath() }));

    return promise;
  }

  global.RecodingFilePicker = { saveAs, open, pickFolder };
})(window);
