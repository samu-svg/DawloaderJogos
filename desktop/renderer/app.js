/** @typedef {import('../src/shared/manifest').Manifest} Manifest */
/** @typedef {import('../src/shared/manifest').ResolvedManifestEntry} ResolvedManifestEntry */
/** @typedef {import('../src/shared/install-state').EntryInstallState} EntryInstallState */

const DEFAULT_SITE_URL = "https://montahd.vercel.app";
const SITE_URL_STORAGE_KEY = "montahd.siteUrl";
/** Fallback quando o Chromium bloqueia localStorage em file:// (sandbox). */
let memorySiteUrl = null;

function readSiteUrlStorage() {
  try {
    return localStorage.getItem(SITE_URL_STORAGE_KEY);
  } catch {
    return memorySiteUrl;
  }
}

function writeSiteUrlStorage(url) {
  memorySiteUrl = url;
  try {
    localStorage.setItem(SITE_URL_STORAGE_KEY, url);
  } catch {
    // memória já atualizada
  }
}

function isTrustedCatalogHost(hostname) {
  const host = hostname.toLowerCase();
  if (!host.endsWith(".vercel.app")) return false;
  const label = host.slice(0, -".vercel.app".length);
  return (
    label === "montahd" ||
    label === "dawloaderjogos" ||
    label.startsWith("montahd-") ||
    label.startsWith("dawloaderjogos-")
  );
}

function isAllowedCatalogOrigin(input, allowLocalhost) {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (isTrustedCatalogHost(parsed.hostname)) return true;
    if (
      allowLocalhost &&
      (parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "[::1]")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function normalizeSiteUrl(input) {
  const raw = (input?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, "");
  if (isAllowedCatalogOrigin(raw, true)) return raw;
  return DEFAULT_SITE_URL;
}

function init() {
  if (!window.montahd) {
    document.body.innerHTML =
      '<div style="padding:24px;font-family:Segoe UI,sans-serif;color:#f4f4f5;background:#08080f;min-height:100vh">' +
      "<h1>MontaHD</h1>" +
      "<p>Não foi possível iniciar a interface. Reinstale o aplicativo ou execute a versão mais recente.</p>" +
      "</div>";
    return;
  }

  void window.montahd.getAppVersion().then((version) => {
    const el = document.getElementById("app-version");
    if (el && version) el.textContent = version;
  }).catch(() => undefined);

  const baseUrlInput = document.getElementById("base-url");
  const slugInput = document.getElementById("slug");
  const loadBtn = document.getElementById("load-btn");
  const loadError = document.getElementById("load-error");
  const welcomePanel = document.getElementById("welcome-panel");
  const welcomeFlow = document.getElementById("welcome-flow");
  const advancedPanel = document.getElementById("advanced-panel");
  const openCatalogBtn = document.getElementById("open-catalog-btn");
  const pickHdSiteBtn = document.getElementById("pick-hd-site-btn");
  const openCatalogAgainBtn = document.getElementById("open-catalog-again-btn");
  const toggleAdvancedBtn = document.getElementById("toggle-advanced-btn");
  const heroPanel = document.getElementById("hero-panel");
  const heroTitle = document.getElementById("hero-title");
  const heroDesc = document.getElementById("hero-desc");
  const manifestSection = document.getElementById("manifest-section");
  const portfolioTitle = document.getElementById("portfolio-title");
  const portfolioMeta = document.getElementById("portfolio-meta");
  const selectFolderBtn = document.getElementById("select-folder-btn");
  const rootPath = document.getElementById("root-path");
  const rootPathCard = document.getElementById("root-path-card");
  const entriesBody = document.getElementById("entries-body");
  const selectAll = document.getElementById("select-all");
  const downloadBtn = document.getElementById("download-btn");
  const clearListBtn = document.getElementById("clear-list-btn");
  const spaceNotice = document.getElementById("space-notice");
  const cancelBtn = document.getElementById("cancel-btn");
  const summary = document.getElementById("summary");
  const step1 = document.getElementById("step-1");
  const step2 = document.getElementById("step-2");
  const confirmModal = document.getElementById("confirm-modal");
  const confirmTitle = document.getElementById("confirm-title");
  const confirmMessage = document.getElementById("confirm-message");
  const confirmPreview = document.getElementById("confirm-preview");
  const confirmOk = document.getElementById("confirm-ok");
  const confirmCancel = document.getElementById("confirm-cancel");
  const openLibraryBtn = document.getElementById("open-library-btn");
  const openLibraryFromInstallBtn = document.getElementById("open-library-from-install-btn");
  const stepLibrary = document.getElementById("step-library");
  const librarySection = document.getElementById("library-section");
  const libraryMeta = document.getElementById("library-meta");
  const libraryBackBtn = document.getElementById("library-back-btn");
  const libraryRefreshBtn = document.getElementById("library-refresh-btn");
  const libraryFolderBtn = document.getElementById("library-folder-btn");
  const libraryPathCard = document.getElementById("library-path-card");
  const libraryPath = document.getElementById("library-path");
  const libraryEmpty = document.getElementById("library-empty");
  const libraryTableShell = document.getElementById("library-table-shell");
  const libraryBody = document.getElementById("library-body");
  const installModeSelect = document.getElementById("install-mode");

  if (
    !baseUrlInput ||
    !slugInput ||
    !loadBtn ||
    !loadError ||
    !welcomePanel ||
    !advancedPanel ||
    !openCatalogBtn ||
    !pickHdSiteBtn ||
    !openCatalogAgainBtn ||
    !toggleAdvancedBtn ||
    !heroPanel ||
    !heroTitle ||
    !heroDesc ||
    !manifestSection ||
    !portfolioTitle ||
    !portfolioMeta ||
    !selectFolderBtn ||
    !rootPath ||
    !rootPathCard ||
    !entriesBody ||
    !selectAll ||
    !downloadBtn ||
    !clearListBtn ||
    !spaceNotice ||
    !cancelBtn ||
    !summary ||
    !step1 ||
    !step2 ||
    !confirmModal ||
    !confirmTitle ||
    !confirmMessage ||
    !confirmPreview ||
    !confirmOk ||
    !confirmCancel ||
    !openLibraryBtn ||
    !openLibraryFromInstallBtn ||
    !stepLibrary ||
    !librarySection ||
    !libraryMeta ||
    !libraryBackBtn ||
    !libraryRefreshBtn ||
    !libraryFolderBtn ||
    !libraryPathCard ||
    !libraryPath ||
    !libraryEmpty ||
    !libraryTableShell ||
    !libraryBody ||
    !installModeSelect
  ) {
    document.body.innerHTML =
      '<div style="padding:24px;font-family:Segoe UI,sans-serif;color:#f4f4f5;background:#08080f">' +
      "<p>Erro ao carregar a interface. Arquivos do app incompletos.</p></div>";
    return;
  }

  /** @type {Manifest | null} */
  let manifest = null;
  /** @type {string[] | null} */
  let pendingEntryFilter = null;
  /** @type {string | null} */
  let pendingManifestToken = null;
  /** @type {string | null} */
  let pendingInstallSession = null;
  /** @type {boolean} */
  let pendingCatalogFromSite = false;
  /** @type {string | null} */
  let selectedRoot = null;
  /** @type {boolean | null} */
  let hdWasAvailable = null;
  let autoResumeArmed = false;
  let autoResumeBusy = false;
  /** @type {Set<string> | null} */
  let pendingAutoResumeIds = null;
  /** @type {string[]} */
  let lastDownloadIds = [];
  /** @type {boolean} */
  let catalogLaunchInFlight = false;
  /** @type {Map<string, { fill: HTMLElement, label: HTMLElement }>} */
  const progressCells = new Map();
  /** @type {Map<string, string>} */
  const activeEntryPhases = new Map();
  /** @type {Map<string, { bytes: number, at: number, mbps: number }>} */
  const downloadSpeedSamples = new Map();

  void window.montahd.getInstallMode().then((mode) => {
    if (installModeSelect instanceof HTMLSelectElement) {
      installModeSelect.value = mode;
    }
  }).catch(() => undefined);

  if (installModeSelect instanceof HTMLSelectElement) {
    installModeSelect.addEventListener("change", () => {
      void window.montahd.setInstallMode(installModeSelect.value).catch(() => undefined);
      updateSpaceNotice();
    });
  }

  function setActiveEntryPhase(entryId, phase) {
    if (!entryId) return;
    if (phase) activeEntryPhases.set(entryId, phase);
    else activeEntryPhases.delete(entryId);
  }

  function clearActiveEntryPhases() {
    activeEntryPhases.clear();
    downloadSpeedSamples.clear();
  }

  function installTagForState(state, entryId) {
    const phase = activeEntryPhases.get(entryId);
    if (phase) {
      const labels = {
        downloading: "baixando…",
        verifying: "verificando…",
        extracting: "preparando arquivos…",
        copying: "copiando para o HD…",
        installing: "instalando no HD…",
      };
      return {
        text: labels[phase] ?? "instalando…",
        tone: "active",
      };
    }

    if (state.kind === "installed") {
      return { text: "já no HD", tone: "ok" };
    }
    if (state.canResume) {
      return { text: "download interrompido", tone: "warn" };
    }
    return { text: "instalação incompleta", tone: "warn" };
  }

  function getSiteUrl() {
    return normalizeSiteUrl(readSiteUrlStorage());
  }

  function saveSiteUrl(url) {
    writeSiteUrlStorage(normalizeSiteUrl(url));
  }

  function catalogUrl() {
    return `${getSiteUrl()}/baixar`;
  }

  function setSummary(text, tone = "muted") {
    summary.textContent = text;
    summary.className = `status-text ${tone === "ok" ? "done" : tone === "error" ? "error" : "muted"}`;
  }

  function setSteps(mode) {
    const catalog = mode === "welcome";
    const install = mode === "install";
    const library = mode === "library";
    step1.classList.toggle("active", catalog);
    step1.classList.toggle("done", install || library);
    step2.classList.toggle("active", install);
    step2.classList.toggle("done", library && Boolean(manifest));
    stepLibrary.classList.toggle("active", library);
    stepLibrary.classList.toggle("done", false);
  }

  function showWelcomeView() {
    welcomePanel.classList.remove("hidden");
    welcomeFlow.classList.remove("hidden");
    openLibraryBtn.classList.remove("hidden");
    toggleAdvancedBtn.classList.remove("hidden");
    manifestSection.classList.add("hidden");
    librarySection.classList.add("hidden");
    heroPanel.classList.remove("hidden");
    heroTitle.textContent = "Escolha no site, instale aqui";
    heroDesc.innerHTML =
      'Abra o catálogo no navegador, marque os jogos e clique em <strong>Instalar no HD</strong>. ' +
      "O app abre já com tudo pronto — você só escolhe a pasta do HD. " +
      "Jogos até 4 GB instalam no HD; acima disso o FAT32 do Xbox 360 exige processar no PC.";
    setSteps("welcome");
  }

  function showInstallView() {
    welcomePanel.classList.add("hidden");
    manifestSection.classList.remove("hidden");
    librarySection.classList.add("hidden");
    heroPanel.classList.add("hidden");
    setSteps("install");
  }

  function showLibraryView() {
    welcomePanel.classList.add("hidden");
    manifestSection.classList.add("hidden");
    librarySection.classList.remove("hidden");
    heroPanel.classList.remove("hidden");
    heroTitle.textContent = "O que tem neste HD";
    heroDesc.textContent =
      "Jogos e DLC com nome. Em Content o Xbox usa códigos — o app traduz pelo catálogo e pelo que já instalou.";
    setSteps("library");
  }

  async function openCatalogInBrowser(button) {
    const target = button ?? openCatalogBtn;
    const previousLabel = target.textContent;
    target.disabled = true;
    target.textContent = "Abrindo…";
    setSummary("Abrindo o catálogo no navegador…");

    try {
      await window.montahd.openExternal(catalogUrl());
      setSummary(
        "Catálogo aberto no navegador. Se pedir login, entre com sua conta, " +
          "selecione os jogos e clique em Instalar no HD.",
      );
    } catch (error) {
      const detail =
        error instanceof Error
          ? unwrapIpcError(error.message)
          : "Não foi possível abrir o navegador.";
      setSummary(
        `${detail} Abra o catálogo em ${catalogUrl()}`,
        "error",
      );
    } finally {
      target.disabled = false;
      target.textContent = previousLabel;
    }
  }

  /** @type {HTMLInputElement} */ (baseUrlInput).value = getSiteUrl();

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
  }

  function formatMbps(mbps) {
    if (!Number.isFinite(mbps) || mbps <= 0) return null;
    if (mbps >= 100) return `${Math.round(mbps)} Mbps`;
    if (mbps >= 10) return `${mbps.toFixed(1)} Mbps`;
    return `${mbps.toFixed(2)} Mbps`;
  }

  function measureDownloadMbps(entryId, downloadedBytes) {
    const now = performance.now();
    const prev = downloadSpeedSamples.get(entryId);
    if (!prev) {
      downloadSpeedSamples.set(entryId, {
        bytes: downloadedBytes,
        at: now,
        mbps: 0,
      });
      return null;
    }

    const elapsedSec = (now - prev.at) / 1000;
    if (elapsedSec < 0.25) {
      return prev.mbps > 0 ? prev.mbps : null;
    }

    const deltaBytes = downloadedBytes - prev.bytes;
    if (deltaBytes < 0) {
      downloadSpeedSamples.set(entryId, {
        bytes: downloadedBytes,
        at: now,
        mbps: 0,
      });
      return null;
    }

    const instantMbps = (deltaBytes * 8) / (elapsedSec * 1_000_000);
    const mbps = prev.mbps > 0 ? prev.mbps * 0.65 + instantMbps * 0.35 : instantMbps;
    downloadSpeedSamples.set(entryId, {
      bytes: downloadedBytes,
      at: now,
      mbps,
    });
    return mbps;
  }

  function clearDownloadSpeed(entryId) {
    downloadSpeedSamples.delete(entryId);
  }

  function groupLabel(group) {
    if (group === "jogo") return "Jogo";
    if (group === "conteudo") return "DLC / Content";
    if (group === "utilitario") return "Utilitário";
    return group ?? "—";
  }

  function createCheckbox(checked, entryId) {
    const label = document.createElement("label");
    label.className = "checkbox-wrap";

    const input = document.createElement("input");
    input.type = "checkbox";
    if (entryId) input.dataset.entryId = entryId;
    input.checked = checked;

    const ui = document.createElement("span");
    ui.className = "checkbox-ui";
    ui.setAttribute("aria-hidden", "true");

    label.append(input, ui);
    return { label, input };
  }

  function createProgressCell() {
    const wrap = document.createElement("div");
    wrap.className = "progress-cell";

    const track = document.createElement("div");
    track.className = "progress-track";

    const fill = document.createElement("div");
    fill.className = "progress-fill";
    track.appendChild(fill);

    const label = document.createElement("span");
    label.className = "progress-label";
    label.textContent = "Aguardando";

    wrap.append(track, label);
    return { wrap, fill, label };
  }

  function setProgress(entryId, percent, text, state = "default") {
    const cell = progressCells.get(entryId);
    if (!cell) return;

    cell.fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    cell.label.textContent = text;
    cell.label.className = "progress-label";
    if (state === "done") cell.label.classList.add("done");
    if (state === "error") cell.label.classList.add("error");
  }

  function getDestinationInput(entryId) {
    return document.querySelector(`input[data-destination-for="${entryId}"]`);
  }

  function checkboxes() {
    return [...entriesBody.querySelectorAll('input[type="checkbox"][data-entry-id]')];
  }

  function selectedEntriesWithDestinations() {
    if (!manifest) return [];

    const selectedIds = new Set(
      checkboxes()
        .filter((input) => input.checked)
        .map((input) => input.dataset.entryId),
    );

    return orderEntriesHdFirst(
      manifest.entries.filter((entry) => selectedIds.has(entry.id)),
    ).map((entry) => {
      const input = getDestinationInput(entry.id);
      const destination = input?.value.trim() || entry.destination;
      return { ...entry, destination };
    });
  }

  const FAT32_MAX_FILE_BYTES = 4 * 1024 * 1024 * 1024 - 1;
  const FAT32_LIMIT_LABEL = "4 GB";

  /** Direto no HD no topo; preserva a ordem relativa. O primeiro da lista começa primeiro. */
  function orderEntriesHdFirst(entries) {
    const hd = [];
    const pc = [];
    for (const entry of entries) {
      if ((entry.sizeBytes || 0) > FAT32_MAX_FILE_BYTES) pc.push(entry);
      else hd.push(entry);
    }
    return [...hd, ...pc];
  }

  function selectedSizes() {
    return selectedEntriesWithDestinations().map((entry) => entry.sizeBytes || 0);
  }

  function largestPcStagingBytes(sizes) {
    return sizes
      .filter((size) => size > FAT32_MAX_FILE_BYTES)
      .reduce((max, size) => Math.max(max, size), 0);
  }

  function installSpaceNotice(sizes) {
    const pcNeeded = largestPcStagingBytes(sizes);
    const mode = installModeSelect instanceof HTMLSelectElement
      ? installModeSelect.value
      : "economico";
    const modeHint =
      mode === "economico"
        ? " No modo Econômico, só um jogo ocupa espaço temporário de cada vez."
        : mode === "equilibrado"
          ? " No modo Equilibrado, até 2 jogos podem descompactar ao mesmo tempo."
          : " No modo Rápido, vários jogos descompactam em paralelo — usa mais espaço temporário.";
    if (sizes.length === 0 || pcNeeded === 0) {
      return (
        `Jogos até ${FAT32_LIMIT_LABEL} são baixados e extraídos direto no HD ` +
        `(formato FAT32 do Xbox 360). Não usam o armazenamento do PC.${modeHint}`
      );
    }
    const sizeLabel = formatBytes(pcNeeded);
    return (
      `Jogos até ${FAT32_LIMIT_LABEL} instalam direto no HD. ` +
      `Pacotes acima de ${FAT32_LIMIT_LABEL} não cabem num único arquivo FAT32 do Xbox 360: ` +
      `são processados no PC e depois copiados para o HD. ` +
      `Deixe pelo menos ${sizeLabel} livres no computador (o maior jogo acima de ${FAT32_LIMIT_LABEL}). ` +
      `Os arquivos temporários do PC são apagados ao terminar.${modeHint}`
    );
  }

  function updateSpaceNotice() {
    const sizes = selectedSizes();
    const pcNeeded = largestPcStagingBytes(sizes);
    spaceNotice.textContent = installSpaceNotice(sizes);
    spaceNotice.classList.toggle("space-notice-warn", pcNeeded > 0);
    spaceNotice.classList.toggle("space-notice-info", pcNeeded === 0);
  }

  function updateDownloadButton() {
    const hasSelection = checkboxes().some((input) => input.checked);
    const hasEntries = Boolean(manifest?.entries.length);
    downloadBtn.disabled = !selectedRoot || !hasSelection || isDownloading();
    clearListBtn.disabled = !hasEntries || isDownloading();
    updateSpaceNotice();

    if (!selectedRoot) {
      downloadBtn.title = "Escolha primeiro a pasta de destino.";
    } else if (!hasSelection) {
      downloadBtn.title = "Marque pelo menos um jogo.";
    } else {
      downloadBtn.title = "";
    }
    clearListBtn.title = hasEntries
      ? "Tirar jogos da lista sem apagar o HD"
      : "Nenhum jogo na lista";
  }

  function renderEntries(entries, options = {}) {
    const allChecked = options.allChecked === true;
    const ordered = orderEntriesHdFirst(entries);
    if (manifest) manifest.entries = ordered;
    entriesBody.innerHTML = "";
    progressCells.clear();

    for (const entry of ordered) {
      const row = document.createElement("tr");

      const checkCell = document.createElement("td");
      checkCell.className = "col-check";
      const { label: checkLabel, input: checkbox } = createCheckbox(
        options.checkedIds
          ? options.checkedIds.has(entry.id)
          : allChecked || !entry.optional,
        entry.id,
      );
      checkbox.addEventListener("change", updateDownloadButton);
      checkCell.appendChild(checkLabel);

      const labelCell = document.createElement("td");
      labelCell.className = "col-game";
      labelCell.title = entry.label;
      labelCell.textContent = entry.label;
      if (entry.optional) {
        const tag = document.createElement("span");
        tag.className = "optional-tag";
        tag.textContent = "opcional";
        labelCell.appendChild(tag);
      }
      const installTag = document.createElement("span");
      installTag.className = "install-tag hidden";
      installTag.dataset.installTag = entry.id;
      labelCell.appendChild(installTag);

      const typeCell = document.createElement("td");
      typeCell.className = "col-type";
      const badge = document.createElement("span");
      badge.className =
        entry.group === "conteudo" ? "badge badge-content" : "badge badge-game";
      badge.textContent = groupLabel(entry.group);
      typeCell.appendChild(badge);

      const destCell = document.createElement("td");
      destCell.className = "col-path";
      const destInput = document.createElement("input");
      destInput.type = "text";
      destInput.className = "input-dest";
      destInput.dataset.destinationFor = entry.id;
      destInput.value = entry.destination;
      destInput.title = entry.destination;
      destInput.addEventListener("change", () => {
        destInput.title = destInput.value.trim() || entry.destination;
        void refreshInstallTags();
      });
      destCell.appendChild(destInput);

      const sizeCell = document.createElement("td");
      sizeCell.className = "col-size";
      sizeCell.textContent = entry.sizeBytes > 0 ? formatBytes(entry.sizeBytes) : "—";

      const targetCell = document.createElement("td");
      targetCell.className = "col-target";
      const targetBadge = document.createElement("span");
      const goesToPc = (entry.sizeBytes || 0) > FAT32_MAX_FILE_BYTES;
      targetBadge.className = goesToPc ? "badge badge-pc" : "badge badge-hd";
      targetBadge.textContent = goesToPc ? "PC → HD" : "Direto no HD";
      targetCell.appendChild(targetBadge);

      const statusCell = document.createElement("td");
      statusCell.className = "col-progress";
      const progress = createProgressCell();
      progress.label.textContent = goesToPc ? "Via PC" : "Direto no HD";
      statusCell.appendChild(progress.wrap);
      progressCells.set(entry.id, { fill: progress.fill, label: progress.label });

      const actionCell = document.createElement("td");
      actionCell.className = "col-action";
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-danger btn-small";
      deleteBtn.textContent = "Remover";
      deleteBtn.title = "Tirar da lista — não apaga o HD";
      deleteBtn.dataset.deleteEntry = entry.id;
      deleteBtn.addEventListener("click", () => {
        removeEntryFromList(entry);
      });
      actionCell.appendChild(deleteBtn);

      row.append(checkCell, labelCell, typeCell, destCell, sizeCell, targetCell, statusCell, actionCell);
      entriesBody.appendChild(row);
    }

    if (selectAll instanceof HTMLInputElement) {
      if (options.checkedIds) {
        selectAll.checked =
          ordered.length > 0 &&
          ordered.every((entry) => options.checkedIds.has(entry.id));
      } else {
        selectAll.checked =
          ordered.length > 0 &&
          ordered.every((entry) => allChecked || !entry.optional);
      }
    }

    updateDownloadButton();
    void refreshInstallTags();
  }

  function paintInstallTag(tag, tagInfo) {
    tag.classList.remove("install-tag-ok", "install-tag-warn", "install-tag-active");
    if (!tagInfo) {
      tag.classList.add("hidden");
      tag.textContent = "";
      return;
    }
    tag.classList.remove("hidden");
    tag.textContent = tagInfo.text;
    if (tagInfo.tone === "ok") tag.classList.add("install-tag-ok");
    else if (tagInfo.tone === "active") tag.classList.add("install-tag-active");
    else tag.classList.add("install-tag-warn");
  }

  function updateInstallTagFromPhase(entryId) {
    const tag = [...entriesBody.querySelectorAll("[data-install-tag]")].find(
      (el) => el.dataset.installTag === entryId,
    );
    if (!tag) return;
    paintInstallTag(
      tag,
      installTagForState({ kind: "incomplete", canResume: true }, entryId),
    );
  }

  let installTagRefresh = null;
  let installTagRefreshQueued = false;

  async function refreshInstallTags() {
    if (installTagRefresh) {
      installTagRefreshQueued = true;
      return installTagRefresh;
    }

    installTagRefresh = (async () => {
      const tags = [...entriesBody.querySelectorAll("[data-install-tag]")];
      if (!selectedRoot || !manifest) {
        for (const tag of tags) paintInstallTag(tag, null);
        return;
      }

      try {
        const states = await window.montahd.inspectInstallState(
          selectedRoot,
          manifest.entries.map((entry) => {
            const input = getDestinationInput(entry.id);
            return {
              id: entry.id,
              label: entry.label,
              destination: input?.value.trim() || entry.destination,
            };
          }),
        );
        const byId = new Map(states.map((state) => [state.entryId, state]));
        for (const tag of tags) {
          const entryId = tag.dataset.installTag;
          const state = byId.get(entryId);
          if (!state && !activeEntryPhases.has(entryId)) {
            paintInstallTag(tag, null);
            continue;
          }
          paintInstallTag(
            tag,
            installTagForState(
              state ?? { kind: "incomplete", canResume: true },
              entryId,
            ),
          );
        }
      } catch {
        // a inspeção é só um aviso visual
      }
    })();

    try {
      await installTagRefresh;
    } finally {
      installTagRefresh = null;
      if (installTagRefreshQueued) {
        installTagRefreshQueued = false;
        void refreshInstallTags();
      }
    }
  }

  function catalogHints() {
    if (!manifest) return [];
    return manifest.entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      destination: entry.destination,
      group: entry.group,
      sizeBytes: entry.sizeBytes,
    }));
  }

  async function persistCatalogHints() {
    if (!selectedRoot || !manifest) return;
    try {
      await window.montahd.rememberHdLabels(selectedRoot, catalogHints());
    } catch {
      // índice local é auxiliar — a lista ainda funciona
    }
  }

  function syncLibraryPath() {
    if (selectedRoot) {
      libraryPath.textContent = selectedRoot;
      libraryPath.classList.remove("muted");
      libraryPathCard.classList.add("ready");
    } else {
      libraryPath.textContent = "Nenhuma pasta selecionada.";
      libraryPath.classList.add("muted");
      libraryPathCard.classList.remove("ready");
    }
  }

  function renderLibrary(items) {
    libraryBody.innerHTML = "";
    const empty = items.length === 0;
    libraryEmpty.classList.toggle("hidden", !empty);
    libraryTableShell.classList.toggle("hidden", empty);
    libraryMeta.textContent = empty
      ? "Nenhum jogo encontrado em Games ou Content."
      : `${items.length} item(ns) neste HD. DLC em Content aparece com o nome, não só o código.`;

    for (const item of items) {
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.className = "col-game";
      nameCell.title = item.label;
      const nameWrap = document.createElement("div");
      nameWrap.className = "item-name";
      const name = document.createElement("strong");
      name.textContent = item.label;
      if (!item.knownName) {
        const tag = document.createElement("span");
        tag.className = "code-tag";
        tag.textContent = "código";
        name.appendChild(tag);
      }
      nameWrap.appendChild(name);
      nameCell.appendChild(nameWrap);

      const typeCell = document.createElement("td");
      typeCell.className = "col-type";
      const badge = document.createElement("span");
      badge.className =
        item.group === "conteudo" ? "badge badge-content" : "badge badge-game";
      badge.textContent = groupLabel(item.group);
      typeCell.appendChild(badge);

      const destCell = document.createElement("td");
      destCell.className = "col-path dest-sub";
      destCell.title = item.destination.replace(/\//g, "\\");
      destCell.textContent = item.destination.replace(/\//g, "\\");

      const sizeCell = document.createElement("td");
      sizeCell.className = "col-size";
      sizeCell.textContent = item.sizeBytes > 0 ? formatBytes(item.sizeBytes) : "—";

      const actionCell = document.createElement("td");
      actionCell.className = "col-action";
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-danger btn-small";
      deleteBtn.textContent = "Excluir";
      deleteBtn.addEventListener("click", () => {
        void deleteLibraryItem(item);
      });
      actionCell.appendChild(deleteBtn);

      row.append(nameCell, typeCell, destCell, sizeCell, actionCell);
      libraryBody.appendChild(row);
    }
  }

  async function refreshLibrary() {
    if (!selectedRoot) {
      renderLibrary([]);
      syncLibraryPath();
      return;
    }

    syncLibraryPath();
    libraryMeta.textContent = "Lendo o HD…";
    await persistCatalogHints();

    try {
      const items = await window.montahd.listHdLibrary(selectedRoot, catalogHints());
      renderLibrary(items);
      setSummary(
        items.length
          ? `${items.length} item(ns) encontrados neste HD.`
          : "Nenhum jogo em Games ou Content nesta pasta.",
      );
    } catch (error) {
      renderLibrary([]);
      setSummary(
        error instanceof Error ? error.message : "Não foi possível ler o HD.",
        "error",
      );
    }
  }

  async function openLibrary(options = {}) {
    const pickIfNeeded = options.pickIfNeeded !== false;
    if (!selectedRoot && pickIfNeeded) {
      await handleFolderSelection({ forLibrary: true });
      if (!selectedRoot) return;
    }
    if (!selectedRoot) {
      setSummary("Escolha a pasta raiz do HD para ver os jogos.", "error");
      return;
    }
    showLibraryView();
    await refreshLibrary();
  }

  function isDownloading() {
    return !cancelBtn.classList.contains("hidden");
  }

  function updatePortfolioMeta() {
    if (!manifest) return;
    const totalBytes = manifest.entries.reduce(
      (sum, entry) => sum + (entry.sizeBytes || 0),
      0,
    );
    manifest.totalBytes = totalBytes;
    const totalLabel = totalBytes > 0 ? ` · ${formatBytes(totalBytes)}` : "";
    portfolioMeta.textContent = `${manifest.entries.length} jogo(s)${totalLabel}`;
  }

  function removeEntryFromList(entry) {
    if (!manifest) return;
    if (isDownloading()) {
      setSummary("Espere o download terminar antes de alterar a lista.", "error");
      return;
    }

    const remainingChecked = new Set(
      checkboxes()
        .filter((input) => input.checked && input.dataset.entryId !== entry.id)
        .map((input) => input.dataset.entryId),
    );
    manifest.entries = manifest.entries.filter((item) => item.id !== entry.id);
    updatePortfolioMeta();
    renderEntries(manifest.entries, { checkedIds: remainingChecked });
    setSummary(
      manifest.entries.length === 0
        ? "Lista vazia. Escolha outros jogos no site."
        : `«${entry.label}» saiu da lista. O arquivo no HD não foi apagado.`,
    );
  }

  async function clearListEntries() {
    if (!manifest?.entries.length) return;
    if (isDownloading()) {
      setSummary("Espere o download terminar antes de alterar a lista.", "error");
      return;
    }

    const selectedIds = new Set(
      checkboxes()
        .filter((input) => input.checked)
        .map((input) => input.dataset.entryId),
    );
    const selectedCount = selectedIds.size;
    const total = manifest.entries.length;
    const removeSelectedOnly = selectedCount > 0 && selectedCount < total;
    const toRemove = removeSelectedOnly
      ? manifest.entries.filter((entry) => selectedIds.has(entry.id))
      : manifest.entries;
    const count = toRemove.length;
    const preview = toRemove
      .slice(0, 12)
      .map((entry) => `• ${entry.label}`)
      .join("\n");
    const extra = count > 12 ? `\n… e mais ${count - 12}` : "";

    const confirmed = await showConfirmModal(
      removeSelectedOnly
        ? `Tirar ${count} jogo(s) selecionado(s) da lista? O HD não será alterado.`
        : `Limpar os ${count} jogo(s) da lista? O HD não será alterado.`,
      `${preview}${extra}`,
      {
        title: "Limpar lista",
        okLabel: "Limpar",
        cancelLabel: "Voltar",
      },
    );
    if (!confirmed) return;

    const removeIds = new Set(toRemove.map((entry) => entry.id));
    const remainingChecked = new Set(
      checkboxes()
        .filter((input) => input.checked && !removeIds.has(input.dataset.entryId))
        .map((input) => input.dataset.entryId),
    );
    manifest.entries = manifest.entries.filter((entry) => !removeIds.has(entry.id));
    updatePortfolioMeta();
    renderEntries(manifest.entries, { checkedIds: remainingChecked });
    setSummary(
      manifest.entries.length === 0
        ? "Lista vazia. Escolha outros jogos no site."
        : `${count} jogo(s) saíram da lista. O HD não foi alterado.`,
    );
  }

  async function deleteLibraryItem(item) {
    if (!selectedRoot) return;
    if (isDownloading()) {
      setSummary("Espere o download terminar antes de excluir.", "error");
      return;
    }

    const preview =
      `${item.label}\n→ ${selectedRoot}\\${item.destination.replace(/\//g, "\\")}`;
    const confirmed = await showConfirmModal(
      `Excluir «${item.label}» do HD? Esta ação não pode ser desfeita.`,
      preview,
      {
        title: "Excluir do HD",
        okLabel: "Excluir",
        danger: true,
      },
    );
    if (!confirmed) return;

    try {
      await window.montahd.deleteHdItem(selectedRoot, item.destination);
      setSummary(`«${item.label}» removido do HD.`, "ok");
      await refreshLibrary();
    } catch (error) {
      setSummary(
        error instanceof Error ? error.message : "Não foi possível excluir.",
        "error",
      );
    }
  }

  function showConfirmModal(message, preview, options = {}) {
    return new Promise((resolve) => {
      const previousTitle = confirmTitle.textContent;
      const previousOk = confirmOk.textContent;
      const previousOkClass = confirmOk.className;
      const previousCancel = confirmCancel.textContent;

      confirmTitle.textContent = options.title ?? "Confirmar download";
      confirmOk.textContent = options.okLabel ?? "Baixar agora";
      confirmOk.className = options.danger ? "btn btn-danger" : "btn btn-primary";
      confirmCancel.textContent = options.cancelLabel ?? "Voltar";
      confirmMessage.textContent = message;
      confirmPreview.textContent = preview;
      confirmModal.classList.remove("hidden");

      const cleanup = (result) => {
        confirmModal.classList.add("hidden");
        confirmTitle.textContent = previousTitle;
        confirmOk.textContent = previousOk;
        confirmOk.className = previousOkClass;
        confirmCancel.textContent = previousCancel;
        confirmOk.removeEventListener("click", onOk);
        confirmCancel.removeEventListener("click", onCancel);
        confirmModal.querySelectorAll("[data-dismiss]").forEach((el) => {
          el.removeEventListener("click", onCancel);
        });
        resolve(result);
      };

      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);

      confirmOk.addEventListener("click", onOk);
      confirmCancel.addEventListener("click", onCancel);
      confirmModal.querySelectorAll("[data-dismiss]").forEach((el) => {
        el.addEventListener("click", onCancel);
      });
    });
  }

  openCatalogBtn.addEventListener("click", () => {
    void openCatalogInBrowser(openCatalogBtn);
  });

  openCatalogAgainBtn.addEventListener("click", () => {
    void openCatalogInBrowser(openCatalogAgainBtn);
  });

  toggleAdvancedBtn.addEventListener("click", () => {
    const opening = advancedPanel.classList.contains("hidden");
    advancedPanel.classList.toggle("hidden");
    toggleAdvancedBtn.textContent = opening ? "Ocultar manual" : "Carregamento manual";
  });

  loadBtn.addEventListener("click", () => {
    void loadManifest({ fromSite: false });
  });

  /** Tira o embrulho "Error invoking remote method '…': Error:" que o IPC adiciona. */
  function unwrapIpcError(text) {
    return text
      .replace(/^Error invoking remote method '[^']*':\s*/i, "")
      .replace(/^(Uncaught\s+)?Error:\s*/i, "")
      .trim();
  }

  function formatInstallError(error) {
    const raw = error instanceof Error ? error.message : "Erro desconhecido.";
    const message = unwrapIpcError(raw) || "Erro desconhecido.";
    if (/HD|hd|vinculad|registrad|plano permite/i.test(message)) {
      return message;
    }
    if (/403|401|Assinatura|autoriz/i.test(message)) {
      return (
        `${message} Volte ao site, clique em Instalar no HD de novo e escolha a pasta do disco.`
      );
    }
    if (/enospc|espaço insuficiente|no space left/i.test(message)) {
      return message.includes("Espaço insuficiente") || message.includes("NTFS")
        ? message
        : "Espaço insuficiente para gravar os arquivos. Verifique o HD (NTFS/exFAT) e se há espaço para o zip + pasta extraída ao mesmo tempo.";
    }
    if (isHdDisconnectText(message)) {
      return "O HD foi desconectado. Reconecte o cabo USB — o MontaHD retoma o download sozinho.";
    }
    return message;
  }

  function formatProgressError(text) {
    if (!text) return "Erro";
    if (isHdDisconnectText(text)) {
      return "HD desconectado. Reconecte o cabo — o download retoma sozinho.";
    }
    if (/enospc|no space left/i.test(text)) {
      return formatInstallError(new Error(text));
    }
    return text;
  }

  function isHdDisconnectText(text) {
    if (!text) return false;
    return /desconect|retoma o download sozinho|device is not ready|cannot find the (path|drive)|sistema não pode encontrar|no such file or directory|unknown error, (write|open|read|stat|unlink)|unidade n[aã]o est|dispositivo n[aã]o est[aá] pronto|\benoent\b|\beio\b|\benxio\b/i.test(
      text,
    );
  }

  function armAutoResume(entryIds) {
    autoResumeArmed = true;
    if (entryIds?.length) {
      pendingAutoResumeIds = new Set(entryIds);
    }
  }

  function confirmModalOpen() {
    return !confirmModal.classList.contains("hidden");
  }

  function applySelectedRoot(folder) {
    selectedRoot = folder;
    hdWasAvailable = true;
    rootPath.textContent = folder;
    rootPath.classList.remove("muted");
    rootPathCard.classList.add("ready");
    syncLibraryPath();
    if (autoResumeArmed) void tryAutoResumeDownloads();
  }

  /**
   * Estado "veio do site, falta o HD". Esconde o passo a passo da tela inicial:
   * ele começa com "Abra o catálogo" e faz parecer que o app voltou ao começo.
   */
  function showPickHdForLaunch() {
    showWelcomeView();
    welcomeFlow.classList.add("hidden");
    openCatalogBtn.classList.add("hidden");
    openLibraryBtn.classList.add("hidden");
    toggleAdvancedBtn.classList.add("hidden");
    pickHdSiteBtn.classList.remove("hidden");
    pickHdSiteBtn.disabled = false;
    heroTitle.textContent = "Jogos recebidos do site";
    heroDesc.textContent =
      "Escolha a pasta raiz do HD onde os jogos serão gravados.";
    setSummary("Clique em Escolher pasta do HD para continuar.");
  }

  async function loadGamesFromInstallSession() {
    if (!pendingInstallSession) {
      throw new Error("Sessão de instalação ausente. Volte ao site e clique em Instalar no HD.");
    }
    const baseUrl = /** @type {HTMLInputElement} */ (baseUrlInput).value.trim();
    pendingManifestToken = await window.montahd.requestManifestToken(baseUrl, {
      session: pendingInstallSession,
    });
    pendingInstallSession = null;
    pendingCatalogFromSite = false;
    pickHdSiteBtn.classList.add("hidden");
    pickHdSiteBtn.disabled = false;
    openCatalogBtn.classList.remove("hidden");
    await loadManifest({ fromSite: true });
  }

  async function applyCatalogLaunch(launch) {
    if (catalogLaunchInFlight) return;
    catalogLaunchInFlight = true;
    await lastHdRestored;

    try {
      window.montahd.log(
        `launch slug=${launch.slug} sessao=${launch.installSession ? "sim" : "nao"} ` +
          `token=${launch.manifestToken ? "sim" : "nao"} ids=${launch.entryIds?.length ?? 0} ` +
          `hd=${selectedRoot ? "lembrado" : "nenhum"}`,
      );
      saveSiteUrl(launch.baseUrl);
      /** @type {HTMLInputElement} */ (baseUrlInput).value = launch.baseUrl;
      /** @type {HTMLInputElement} */ (slugInput).value = launch.slug;
      pendingEntryFilter = launch.entryIds?.length ? launch.entryIds : null;
      pendingInstallSession = launch.installSession ?? null;
      pendingManifestToken = launch.manifestToken ?? null;
      pendingCatalogFromSite = false;
      pickHdSiteBtn.classList.add("hidden");
      pickHdSiteBtn.disabled = false;
      loadError.classList.add("hidden");

      pendingCatalogFromSite = true;
      openCatalogBtn.classList.add("hidden");

      setSummary(
        pendingInstallSession
          ? "Carregando jogos do site…"
          : "Carregando jogos selecionados no site…",
      );

      try {
        if (pendingInstallSession) await loadGamesFromInstallSession();
        else await loadManifest({ fromSite: true });
      } catch (error) {
        const detail = formatInstallError(error);
        window.montahd.log(`launch falhou: ${detail}`);
        showWelcomeView();
        loadError.textContent = detail;
        loadError.classList.remove("hidden");
        setSummary("Não foi possível carregar os jogos do site.", "error");
      }
    } finally {
      catalogLaunchInFlight = false;
    }
  }

  /**
   * O deep link do site chega assim que a página carrega, antes de o HD
   * lembrado voltar do processo principal. Sem esperar por isso, quem já tinha
   * escolhido o HD caía na tela de escolher pasta em vez de ir para a lista.
   */
  const lastHdRestored = (async () => {
    try {
      const lastRoot = await window.montahd.getLastHdRoot();
      if (lastRoot) applySelectedRoot(lastRoot);
    } catch {
      // sem HD lembrado
    }
  })();

  window.montahd.onCatalogLaunch((launch) => {
    void applyCatalogLaunch(launch);
  });

  void (async () => {
    await lastHdRestored;

    const launch = await window.montahd.consumeCatalogLaunch();
    if (launch) {
      void applyCatalogLaunch(launch);
      return;
    }
    if (catalogLaunchInFlight) return;
    setSummary(
      selectedRoot
        ? "HD lembrado. Aguardando seleção pelo site…"
        : "Aguardando seleção pelo site…",
    );
  })();

  async function loadManifest(options = {}) {
    const fromSite = options.fromSite === true;
    const baseUrl = /** @type {HTMLInputElement} */ (baseUrlInput).value.trim();
    const slug = /** @type {HTMLInputElement} */ (slugInput).value.trim();

    if (!fromSite && !slug) {
      loadError.textContent = "Informe o slug do portfólio ou use o catálogo no site.";
      loadError.classList.remove("hidden");
      return;
    }

    saveSiteUrl(baseUrl);
    loadError.classList.add("hidden");
    loadBtn.disabled = true;
    loadBtn.querySelector(".btn-label").textContent = "Carregando…";
    setSummary(fromSite ? "Recebendo jogos do site…" : "Buscando manifesto do portfólio…");

    try {
      manifest = await window.montahd.fetchManifest(
        baseUrl,
        slug,
        pendingManifestToken ?? undefined,
      );

      let entries = manifest.entries;
      const entryFilter = pendingEntryFilter;
      const hadManifestToken = Boolean(pendingManifestToken);
      pendingEntryFilter = null;
      pendingManifestToken = null;

      // Sem token, filtra no cliente pelos ids da URL (acervo aberto).
      if (entryFilter?.length && !hadManifestToken) {
        const allowed = new Set(entryFilter);
        entries = entries.filter((entry) => allowed.has(entry.id));
        if (entries.length === 0) {
          throw new Error(
            "Os jogos selecionados no site não foram encontrados neste catálogo.",
          );
        }
        manifest = {
          ...manifest,
          entries,
          totalBytes: entries.reduce((sum, entry) => sum + entry.sizeBytes, 0),
        };
      }

      manifest = {
        ...manifest,
        entries: orderEntriesHdFirst(manifest.entries),
      };

      portfolioTitle.textContent = manifest.portfolio.title;
      const totalLabel =
        manifest.totalBytes > 0 ? ` · ${formatBytes(manifest.totalBytes)}` : "";
      portfolioMeta.textContent = `${manifest.entries.length} jogo(s)${totalLabel}`;
      renderEntries(manifest.entries, { allChecked: fromSite });
      pendingCatalogFromSite = false;
      openCatalogBtn.classList.remove("hidden");
      showInstallView();
      await persistCatalogHints();
      setSummary(
        selectedRoot
          ? `${manifest.entries.length} jogo(s) recebidos do site. Pronto para baixar.`
          : `${manifest.entries.length} jogo(s) recebidos do site. Escolha a pasta de destino.`,
      );
    } catch (error) {
      const detail = formatInstallError(error);
      window.montahd.log(`manifesto falhou (fromSite=${fromSite}): ${detail}`);
      if (fromSite && pendingCatalogFromSite) {
        showPickHdForLaunch();
      } else if (fromSite) {
        showWelcomeView();
      }
      loadError.textContent = detail;
      loadError.classList.remove("hidden");
      setSummary("Não foi possível carregar os jogos.", "error");
    } finally {
      loadBtn.disabled = false;
      loadBtn.querySelector(".btn-label").textContent = "Carregar manifesto";
    }
  }

  async function handleFolderSelection(options = {}) {
    const forLibrary = options.forLibrary === true;
    const folder = await window.montahd.selectFolder();
    if (!folder) return;

    applySelectedRoot(folder);

    await persistCatalogHints();

    if (forLibrary || !librarySection.classList.contains("hidden")) {
      showLibraryView();
      await refreshLibrary();
      return;
    }

    setSummary(
      manifest
        ? "Pasta selecionada. Pronto para iniciar o download."
        : "Pasta selecionada.",
    );
    updateDownloadButton();
    void refreshInstallTags();
  }

  selectFolderBtn.addEventListener("click", () => {
    void handleFolderSelection();
  });

  pickHdSiteBtn.addEventListener("click", () => {
    void handleFolderSelection();
  });

  openLibraryBtn.addEventListener("click", () => {
    void openLibrary({ pickIfNeeded: true });
  });

  openLibraryFromInstallBtn.addEventListener("click", () => {
    void openLibrary({ pickIfNeeded: true });
  });

  stepLibrary.addEventListener("click", () => {
    void openLibrary({ pickIfNeeded: true });
  });

  libraryBackBtn.addEventListener("click", () => {
    if (manifest) showInstallView();
    else showWelcomeView();
  });

  libraryRefreshBtn.addEventListener("click", () => {
    void refreshLibrary();
  });

  libraryFolderBtn.addEventListener("click", () => {
    void handleFolderSelection({ forLibrary: true });
  });

  selectAll.addEventListener("change", () => {
    for (const input of checkboxes()) {
      input.checked = selectAll.checked;
    }
    updateDownloadButton();
  });

  clearListBtn.addEventListener("click", () => {
    void clearListEntries();
  });

  async function executeDownload(toDownload, resetEntryIds) {
    if (!selectedRoot || toDownload.length === 0) return;

    const sizes = toDownload.map((entry) => entry.sizeBytes || 0);
    const pcNeeded = largestPcStagingBytes(sizes);
    if (pcNeeded > 0) {
      try {
        const disk = await window.montahd.getPcDiskSpace();
        if (disk.freeBytes < pcNeeded) {
          setSummary(
            `Espaço insuficiente no PC para jogos acima de ${FAT32_LIMIT_LABEL}. ` +
              `Livre: ${formatBytes(disk.freeBytes)}. ` +
              `Necessário pelo menos ${formatBytes(pcNeeded)} (maior pacote acima de ${FAT32_LIMIT_LABEL}). ` +
              `Libere espaço no computador e tente de novo.`,
            "error",
          );
          return;
        }
      } catch {
        // o processo principal também confere o espaço
      }
    }

    downloadBtn.disabled = true;
    cancelBtn.classList.remove("hidden");
    clearListBtn.disabled = true;
    installModeSelect.disabled = true;
    clearActiveEntryPhases();
    lastDownloadIds = toDownload.map((entry) => entry.id);
    setSummary("Download em andamento…");

    for (const entry of toDownload) {
      setProgress(entry.id, 0, "Na fila");
    }

    const idsToReset = [...new Set(resetEntryIds)].filter((id) =>
      toDownload.some((entry) => entry.id === id),
    );

    try {
      const result = await window.montahd.startDownload(selectedRoot, toDownload, {
        resetEntryIds: idsToReset,
      });
      const failed = result.results.filter((item) => !item.ok);
      if (failed.some((item) => isHdDisconnectText(item.error ?? ""))) {
        armAutoResume(failed.map((item) => item.entryId));
        setSummary(
          "HD desconectado. Reconecte o cabo USB — o download retoma sozinho.",
          "error",
        );
      } else {
        const okCount = result.results.filter((item) => item.ok).length;
        setSummary(
          `Concluído: ${okCount}/${result.results.length} jogo(s) instalados.`,
          okCount === result.results.length ? "ok" : "error",
        );
      }
      void refreshInstallTags();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro durante o download.";
      if (isHdDisconnectText(message)) {
        armAutoResume(lastDownloadIds);
        setSummary(
          "HD desconectado. Reconecte o cabo USB — o download retoma sozinho.",
          "error",
        );
      } else {
        setSummary(message, "error");
      }
    } finally {
      downloadBtn.disabled = false;
      cancelBtn.classList.add("hidden");
      installModeSelect.disabled = false;
      clearActiveEntryPhases();
      updateDownloadButton();
      void refreshInstallTags();
    }
  }

  async function tryAutoResumeDownloads() {
    if (autoResumeBusy || isDownloading() || !manifest || !selectedRoot) return;
    if (confirmModalOpen()) return;

    autoResumeBusy = true;
    try {
      let available = false;
      try {
        available = await window.montahd.hdRootAvailable(selectedRoot);
      } catch {
        available = false;
      }
      if (!available) return;

      const selected = selectedEntriesWithDestinations();
      if (selected.length === 0) return;

      const wanted = pendingAutoResumeIds
        ? selected.filter((entry) => pendingAutoResumeIds.has(entry.id))
        : selected;
      if (wanted.length === 0) return;

      /** @type {string[]} */
      const resetEntryIds = [];
      let toDownload = wanted;
      const sessionIds = pendingAutoResumeIds;

      try {
        const states = await window.montahd.inspectInstallState(selectedRoot, wanted);
        const installedIds = new Set(
          states.filter((state) => state.kind === "installed").map((state) => state.entryId),
        );
        const resumableIds = new Set(
          states
            .filter((state) => state.kind === "incomplete" && state.canResume)
            .map((state) => state.entryId),
        );
        const leftoverIds = new Set(
          states
            .filter((state) => state.kind === "incomplete" && !state.canResume)
            .map((state) => state.entryId),
        );

        toDownload = wanted.filter((entry) => !installedIds.has(entry.id));

        if (sessionIds) {
          for (const entry of toDownload) {
            if (leftoverIds.has(entry.id)) resetEntryIds.push(entry.id);
          }
        } else {
          toDownload = toDownload.filter((entry) => resumableIds.has(entry.id));
        }
      } catch {
        if (!sessionIds) toDownload = [];
      }

      if (toDownload.length === 0) {
        autoResumeArmed = false;
        pendingAutoResumeIds = null;
        return;
      }

      pendingAutoResumeIds = null;
      autoResumeArmed = false;
      setSummary(
        toDownload.length === 1
          ? `HD reconectado. Retomando «${toDownload[0].label}»…`
          : `HD reconectado. Retomando ${toDownload.length} download(s)…`,
      );
      await executeDownload(toDownload, resetEntryIds);
    } finally {
      autoResumeBusy = false;
    }
  }

  async function pollHdPresence() {
    if (!selectedRoot) return;

    let available = false;
    try {
      available = await window.montahd.hdRootAvailable(selectedRoot);
    } catch {
      available = false;
    }

    if (available) {
      const shouldResume = hdWasAvailable === false || autoResumeArmed;
      hdWasAvailable = true;
      if (shouldResume) void tryAutoResumeDownloads();
      return;
    }

    if (hdWasAvailable === true) {
      if (isDownloading() && lastDownloadIds.length > 0) {
        armAutoResume(lastDownloadIds);
        void window.montahd.cancelDownload();
      } else {
        autoResumeArmed = true;
      }
      setSummary(
        "HD desconectado. Reconecte o cabo USB — o download retoma sozinho.",
        "error",
      );
    }
    hdWasAvailable = false;
  }

  downloadBtn.addEventListener("click", async () => {
    if (!manifest || !selectedRoot) return;

    const entries = selectedEntriesWithDestinations();
    if (entries.length === 0) return;

    /** @type {string[]} */
    const resetEntryIds = [];
    let toDownload = entries;

    try {
      const states = await window.montahd.inspectInstallState(selectedRoot, entries);
      const utilitySkipIds = new Set(["abadavatar"]);
      const installed = states.filter((state) => state.kind === "installed");
      const autoSkipInstalled = installed.filter((state) =>
        utilitySkipIds.has(state.entryId),
      );
      const promptInstalled = installed.filter(
        (state) => !utilitySkipIds.has(state.entryId),
      );
      const resumable = states.filter(
        (state) => state.kind === "incomplete" && state.canResume,
      );
      const leftover = states.filter(
        (state) => state.kind === "incomplete" && !state.canResume,
      );

      if (promptInstalled.length > 0) {
        const reinstall = await showConfirmModal(
          promptInstalled.length === 1
            ? `«${promptInstalled[0].label}» já está neste HD. Instalar de novo apaga a cópia atual e baixa outra vez.`
            : `${promptInstalled.length} jogos já estão neste HD. Instalar de novo apaga as cópias atuais e baixa outra vez.`,
          promptInstalled.map((state) => `• ${state.label}`).join("\n"),
          {
            title: "Já instalado neste HD",
            okLabel: "Instalar de novo",
            cancelLabel: "Manter os atuais",
            danger: true,
          },
        );
        if (reinstall) {
          resetEntryIds.push(...promptInstalled.map((state) => state.entryId));
        } else {
          const skip = new Set(promptInstalled.map((state) => state.entryId));
          toDownload = toDownload.filter((entry) => !skip.has(entry.id));
        }
      }

      if (autoSkipInstalled.length > 0) {
        const skip = new Set(autoSkipInstalled.map((state) => state.entryId));
        toDownload = toDownload.filter((entry) => !skip.has(entry.id));
      }

      if (resumable.length > 0) {
        const still = resumable.filter((state) =>
          toDownload.some((entry) => entry.id === state.entryId),
        );
        if (still.length > 0) {
          const resume = await showConfirmModal(
            still.length === 1
              ? `O download de «${still[0].label}» ficou pela metade. Dá para continuar de onde parou.`
              : `${still.length} downloads ficaram pela metade. Dá para continuar de onde pararam.`,
            still.map((state) => `• ${state.label}`).join("\n"),
            {
              title: "Download interrompido",
              okLabel: "Retomar",
              cancelLabel: "Não retomar",
            },
          );
          if (!resume) {
            const restart = await showConfirmModal(
              "Apagar o arquivo pela metade e começar o download do zero?",
              still.map((state) => `• ${state.label}`).join("\n"),
              {
                title: "Começar de novo",
                okLabel: "Apagar e recomeçar",
                cancelLabel: "Pular estes",
                danger: true,
              },
            );
            if (restart) {
              resetEntryIds.push(...still.map((state) => state.entryId));
            } else {
              const skip = new Set(still.map((state) => state.entryId));
              toDownload = toDownload.filter((entry) => !skip.has(entry.id));
            }
          }
        }
      }

      if (leftover.length > 0) {
        const still = leftover.filter((state) =>
          toDownload.some((entry) => entry.id === state.entryId),
        );
        if (still.length > 0) {
          const restart = await showConfirmModal(
            still.length === 1
              ? `A instalação de «${still[0].label}» não terminou. Não dá para retomar com segurança — apagar o que ficou e instalar de novo?`
              : `${still.length} instalações não terminaram. Não dá para retomar com segurança — apagar o que ficou e instalar de novo?`,
            still.map((state) => `• ${state.label}`).join("\n"),
            {
              title: "Instalação incompleta",
              okLabel: "Apagar e instalar",
              cancelLabel: "Pular estes",
              danger: true,
            },
          );
          if (restart) {
            resetEntryIds.push(...still.map((state) => state.entryId));
          } else {
            const skip = new Set(still.map((state) => state.entryId));
            toDownload = toDownload.filter((entry) => !skip.has(entry.id));
          }
        }
      }
    } catch {
      // se a inspeção falhar, segue o fluxo normal de download
    }

    if (toDownload.length === 0) {
      setSummary("Nada a baixar: os jogos selecionados já estão no HD ou foram pulados.");
      return;
    }

    const preview = toDownload
      .map(
        (entry) =>
          `• ${entry.label}\n  → ${selectedRoot}\\${entry.destination.replace(/\//g, "\\")}`,
      )
      .join("\n\n");

    const sizes = toDownload.map((entry) => entry.sizeBytes || 0);
    const confirmed = await showConfirmModal(
      `Baixar ${toDownload.length} jogo(s)? ` + installSpaceNotice(sizes),
      preview,
    );
    if (!confirmed) return;

    autoResumeArmed = false;
    pendingAutoResumeIds = null;
    await executeDownload(toDownload, resetEntryIds);
  });

  cancelBtn.addEventListener("click", async () => {
    if (hdWasAvailable !== false) {
      autoResumeArmed = false;
      pendingAutoResumeIds = null;
    }
    await window.montahd.cancelDownload();
    clearActiveEntryPhases();
    setSummary(
      hdWasAvailable === false
        ? "HD desconectado. Reconecte o cabo USB — o download retoma sozinho."
        : "Download cancelado.",
      "error",
    );
    cancelBtn.classList.add("hidden");
    downloadBtn.disabled = false;
    updateDownloadButton();
  });

  setInterval(() => {
    void pollHdPresence();
  }, 2500);

  const lastProgressStatus = new Map();

  window.montahd.onDownloadProgress((event) => {
    const prevStatus = lastProgressStatus.get(event.entryId);
    lastProgressStatus.set(event.entryId, event.status);

    if (event.status === "downloading") {
      setActiveEntryPhase(event.entryId, "downloading");
      const pct =
        event.totalBytes > 0 ? (event.downloadedBytes / event.totalBytes) * 100 : 0;
      const where = event.target === "pc" ? "no PC" : "no HD";
      const speedLabel = formatMbps(
        measureDownloadMbps(event.entryId, event.downloadedBytes),
      );
      const progressText = `${where} ${formatBytes(event.downloadedBytes)} / ${formatBytes(event.totalBytes)}`;
      setProgress(
        event.entryId,
        pct,
        speedLabel ? `${progressText} · ${speedLabel}` : progressText,
      );
    } else if (event.status === "verifying") {
      clearDownloadSpeed(event.entryId);
      setActiveEntryPhase(event.entryId, "verifying");
      setProgress(event.entryId, 92, "Verificando integridade…");
    } else if (event.status === "extracting") {
      clearDownloadSpeed(event.entryId);
      setActiveEntryPhase(event.entryId, "extracting");
      const where = event.target === "pc" ? "no PC" : "no HD";
      setProgress(event.entryId, 96, `Descompactando ${where}…`);
    } else if (event.status === "copying") {
      clearDownloadSpeed(event.entryId);
      setActiveEntryPhase(event.entryId, "copying");
      const pct =
        event.totalBytes > 0 ? (event.downloadedBytes / event.totalBytes) * 100 : 0;
      setProgress(
        event.entryId,
        Math.max(pct, 90),
        `PC → HD ${formatBytes(event.downloadedBytes)} / ${formatBytes(event.totalBytes)}`,
      );
    } else if (event.status === "installing") {
      clearDownloadSpeed(event.entryId);
      setActiveEntryPhase(event.entryId, "installing");
      const pct =
        event.totalBytes > 0 ? (event.downloadedBytes / event.totalBytes) * 100 : 0;
      setProgress(
        event.entryId,
        Math.max(pct, 90),
        `Instalando no HD ${formatBytes(event.downloadedBytes)} / ${formatBytes(event.totalBytes)}`,
      );
    } else if (event.status === "done") {
      clearDownloadSpeed(event.entryId);
      setActiveEntryPhase(event.entryId, null);
      lastProgressStatus.delete(event.entryId);
      setProgress(event.entryId, 100, "Concluído", "done");
    } else if (event.status === "error") {
      clearDownloadSpeed(event.entryId);
      setActiveEntryPhase(event.entryId, null);
      lastProgressStatus.delete(event.entryId);
      const errText = formatProgressError(event.error ?? "Erro");
      setProgress(event.entryId, 100, errText, "error");
      if (/espaço insuficiente|enospc/i.test(errText)) {
        setSummary(errText, "error");
      } else if (isHdDisconnectText(event.error ?? errText)) {
        armAutoResume([event.entryId, ...lastDownloadIds]);
        setSummary(
          "HD desconectado. Reconecte o cabo USB — o download retoma sozinho.",
          "error",
        );
      }
    }

    if (event.status !== prevStatus) {
      updateInstallTagFromPhase(event.entryId);
    }
    if (event.status === "done" || event.status === "error") {
      void refreshInstallTags();
    }
  });

  window.montahd.onDownloadComplete(({ results }) => {
    const okCount = results.filter((item) => item.ok).length;
    const failed = results.filter((item) => !item.ok && item.error);
    const diskFull = failed.some((item) =>
      /espaço insuficiente|enospc|no space left/i.test(item.error ?? ""),
    );
    const disconnected = failed.some((item) => isHdDisconnectText(item.error ?? ""));
    if (disconnected || (autoResumeArmed && hdWasAvailable === false)) {
      if (disconnected) armAutoResume(failed.map((item) => item.entryId));
      setSummary(
        "HD desconectado. Reconecte o cabo USB — o download retoma sozinho.",
        "error",
      );
    } else if (diskFull && okCount < results.length) {
      setSummary(
        "Instalação interrompida: falta espaço no disco. Jogos até 4 GB instalam no HD; " +
          "pacotes maiores usam o PC por causa do FAT32 do Xbox 360. Libere espaço e tente de novo.",
        "error",
      );
    } else {
      setSummary(
        `Concluído: ${okCount}/${results.length} jogo(s) instalados.`,
        okCount === results.length ? "ok" : "error",
      );
    }
    cancelBtn.classList.add("hidden");
    downloadBtn.disabled = false;
    clearActiveEntryPhases();
    updateDownloadButton();
    void refreshInstallTags();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
