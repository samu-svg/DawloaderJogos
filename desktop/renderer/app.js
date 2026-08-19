/** @typedef {import('../src/shared/manifest').Manifest} Manifest */
/** @typedef {import('../src/shared/manifest').ResolvedManifestEntry} ResolvedManifestEntry */

const DEFAULT_SITE_URL = "https://montahd.vercel.app";
const SITE_URL_STORAGE_KEY = "montahd.siteUrl";

function init() {
  if (!window.montahd) {
    document.body.innerHTML =
      '<div style="padding:24px;font-family:Segoe UI,sans-serif;color:#f4f4f5;background:#08080f;min-height:100vh">' +
      "<h1>MontaHD</h1>" +
      "<p>Não foi possível iniciar a interface. Reinstale o aplicativo ou execute a versão mais recente.</p>" +
      "</div>";
    return;
  }

  const baseUrlInput = document.getElementById("base-url");
  const slugInput = document.getElementById("slug");
  const loadBtn = document.getElementById("load-btn");
  const loadError = document.getElementById("load-error");
  const welcomePanel = document.getElementById("welcome-panel");
  const advancedPanel = document.getElementById("advanced-panel");
  const openCatalogBtn = document.getElementById("open-catalog-btn");
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
  const cancelBtn = document.getElementById("cancel-btn");
  const summary = document.getElementById("summary");
  const step1 = document.getElementById("step-1");
  const step2 = document.getElementById("step-2");
  const confirmModal = document.getElementById("confirm-modal");
  const confirmMessage = document.getElementById("confirm-message");
  const confirmPreview = document.getElementById("confirm-preview");
  const confirmOk = document.getElementById("confirm-ok");
  const confirmCancel = document.getElementById("confirm-cancel");

  if (
    !baseUrlInput ||
    !slugInput ||
    !loadBtn ||
    !loadError ||
    !welcomePanel ||
    !advancedPanel ||
    !openCatalogBtn ||
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
    !cancelBtn ||
    !summary ||
    !step1 ||
    !step2 ||
    !confirmModal ||
    !confirmMessage ||
    !confirmPreview ||
    !confirmOk ||
    !confirmCancel
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
  let selectedRoot = null;
  /** @type {boolean} */
  let catalogLaunchInFlight = false;
  /** @type {Map<string, { fill: HTMLElement, label: HTMLElement }>} */
  const progressCells = new Map();

  function getSiteUrl() {
    const stored = localStorage.getItem(SITE_URL_STORAGE_KEY);
    return (stored || DEFAULT_SITE_URL).replace(/\/+$/, "");
  }

  function saveSiteUrl(url) {
    localStorage.setItem(SITE_URL_STORAGE_KEY, url.replace(/\/+$/, ""));
  }

  function catalogUrl() {
    return `${getSiteUrl()}/baixar`;
  }

  function setSummary(text, tone = "muted") {
    summary.textContent = text;
    summary.className = `status-text ${tone === "ok" ? "done" : tone === "error" ? "error" : "muted"}`;
  }

  function setSteps(manifestLoaded) {
    step1.classList.toggle("active", !manifestLoaded);
    step1.classList.toggle("done", manifestLoaded);
    step2.classList.toggle("active", manifestLoaded);
  }

  function showWelcomeView() {
    welcomePanel.classList.remove("hidden");
    manifestSection.classList.add("hidden");
    heroPanel.classList.remove("hidden");
    heroTitle.textContent = "Escolha no site, instale aqui";
    heroDesc.innerHTML =
      'Abra o catálogo no navegador, marque os jogos e clique em <strong>Instalar no HD</strong>. ' +
      "O app abre já com tudo pronto — você só escolhe a pasta do HD.";
    setSteps(false);
  }

  function showInstallView() {
    welcomePanel.classList.add("hidden");
    manifestSection.classList.remove("hidden");
    heroPanel.classList.add("hidden");
    setSteps(true);
  }

  async function openCatalogInBrowser() {
    try {
      await window.montahd.openExternal(catalogUrl());
      setSummary("Catálogo aberto no navegador. Selecione jogos e clique em Instalar no HD.");
    } catch (error) {
      setSummary(
        error instanceof Error ? error.message : "Não foi possível abrir o navegador.",
        "error",
      );
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

  function groupLabel(group) {
    if (group === "jogo") return "Jogo";
    if (group === "conteudo") return "DLC / Content";
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

    return manifest.entries
      .filter((entry) => selectedIds.has(entry.id))
      .map((entry) => {
        const input = getDestinationInput(entry.id);
        const destination = input?.value.trim() || entry.destination;
        return { ...entry, destination };
      });
  }

  function updateDownloadButton() {
    const hasSelection = checkboxes().some((input) => input.checked);
    downloadBtn.disabled = !selectedRoot || !hasSelection;

    if (!selectedRoot) {
      downloadBtn.title = "Escolha primeiro a pasta de destino.";
    } else if (!hasSelection) {
      downloadBtn.title = "Marque pelo menos um jogo.";
    } else {
      downloadBtn.title = "";
    }
  }

  function renderEntries(entries, options = {}) {
    const allChecked = options.allChecked === true;
    entriesBody.innerHTML = "";
    progressCells.clear();

    for (const entry of entries) {
      const row = document.createElement("tr");

      const checkCell = document.createElement("td");
      const { label: checkLabel, input: checkbox } = createCheckbox(
        allChecked || !entry.optional,
        entry.id,
      );
      checkbox.addEventListener("change", updateDownloadButton);
      checkCell.appendChild(checkLabel);

      const labelCell = document.createElement("td");
      labelCell.textContent = entry.label;
      if (entry.optional) {
        const tag = document.createElement("span");
        tag.className = "optional-tag";
        tag.textContent = "opcional";
        labelCell.appendChild(tag);
      }

      const typeCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className =
        entry.group === "conteudo" ? "badge badge-content" : "badge badge-game";
      badge.textContent = groupLabel(entry.group);
      typeCell.appendChild(badge);

      const destCell = document.createElement("td");
      const destInput = document.createElement("input");
      destInput.type = "text";
      destInput.className = "input-dest";
      destInput.dataset.destinationFor = entry.id;
      destInput.value = entry.destination;
      destCell.appendChild(destInput);

      const sizeCell = document.createElement("td");
      sizeCell.textContent = entry.sizeBytes > 0 ? formatBytes(entry.sizeBytes) : "—";

      const statusCell = document.createElement("td");
      const progress = createProgressCell();
      statusCell.appendChild(progress.wrap);
      progressCells.set(entry.id, { fill: progress.fill, label: progress.label });

      row.append(checkCell, labelCell, typeCell, destCell, sizeCell, statusCell);
      entriesBody.appendChild(row);
    }

    if (selectAll instanceof HTMLInputElement) {
      selectAll.checked =
        entries.length > 0 &&
        entries.every((entry) => allChecked || !entry.optional);
    }

    updateDownloadButton();
  }

  function showConfirmModal(message, preview) {
    return new Promise((resolve) => {
      confirmMessage.textContent = message;
      confirmPreview.textContent = preview;
      confirmModal.classList.remove("hidden");

      const cleanup = (result) => {
        confirmModal.classList.add("hidden");
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
    void openCatalogInBrowser();
  });

  openCatalogAgainBtn.addEventListener("click", () => {
    void openCatalogInBrowser();
  });

  toggleAdvancedBtn.addEventListener("click", () => {
    const opening = advancedPanel.classList.contains("hidden");
    advancedPanel.classList.toggle("hidden");
    toggleAdvancedBtn.textContent = opening ? "Ocultar manual" : "Carregamento manual";
  });

  loadBtn.addEventListener("click", () => {
    void loadManifest({ fromSite: false });
  });

  async function applyCatalogLaunch(launch) {
    if (catalogLaunchInFlight) return;
    catalogLaunchInFlight = true;

    try {
      saveSiteUrl(launch.baseUrl);
      /** @type {HTMLInputElement} */ (baseUrlInput).value = launch.baseUrl;
      /** @type {HTMLInputElement} */ (slugInput).value = launch.slug;
      pendingEntryFilter = launch.entryIds?.length ? launch.entryIds : null;
      pendingManifestToken = launch.manifestToken ?? null;
      await loadManifest({ fromSite: true });
    } finally {
      catalogLaunchInFlight = false;
    }
  }

  window.montahd.onCatalogLaunch((launch) => {
    void applyCatalogLaunch(launch);
  });

  void window.montahd.consumeCatalogLaunch().then((launch) => {
    if (launch) {
      void applyCatalogLaunch(launch);
      return;
    }
    setSummary("Aguardando seleção pelo site…");
  });

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

      portfolioTitle.textContent = manifest.portfolio.title;
      const totalLabel =
        manifest.totalBytes > 0 ? ` · ${formatBytes(manifest.totalBytes)}` : "";
      portfolioMeta.textContent = `${manifest.entries.length} jogo(s)${totalLabel}`;
      renderEntries(manifest.entries, { allChecked: fromSite });
      showInstallView();
      setSummary(
        selectedRoot
          ? `${manifest.entries.length} jogo(s) recebidos do site. Pronto para baixar.`
          : `${manifest.entries.length} jogo(s) recebidos do site. Escolha a pasta de destino.`,
      );
    } catch (error) {
      loadError.textContent =
        error instanceof Error ? error.message : "Erro ao carregar manifesto.";
      loadError.classList.remove("hidden");
      setSummary("Não foi possível carregar os jogos.", "error");
      if (fromSite) showWelcomeView();
    } finally {
      loadBtn.disabled = false;
      loadBtn.querySelector(".btn-label").textContent = "Carregar manifesto";
    }
  }

  selectFolderBtn.addEventListener("click", async () => {
    const folder = await window.montahd.selectFolder();
    if (!folder) return;
    selectedRoot = folder;
    rootPath.textContent = folder;
    rootPath.classList.remove("muted");
    rootPathCard.classList.add("ready");
    setSummary(
      manifest
        ? "Pasta selecionada. Pronto para iniciar o download."
        : "Pasta selecionada.",
    );
    updateDownloadButton();
  });

  selectAll.addEventListener("change", () => {
    for (const input of checkboxes()) {
      input.checked = selectAll.checked;
    }
    updateDownloadButton();
  });

  downloadBtn.addEventListener("click", async () => {
    if (!manifest || !selectedRoot) return;

    const entries = selectedEntriesWithDestinations();
    if (entries.length === 0) return;

    const preview = entries
      .map(
        (entry) =>
          `• ${entry.label}\n  → ${selectedRoot}\\${entry.destination.replace(/\//g, "\\")}`,
      )
      .join("\n\n");

    const confirmed = await showConfirmModal(
      `Baixar ${entries.length} jogo(s)? Arquivos .zip são descompactados automaticamente na pasta de destino.`,
      preview,
    );
    if (!confirmed) return;

    downloadBtn.disabled = true;
    cancelBtn.classList.remove("hidden");
    setSummary("Download em andamento…");

    for (const entry of entries) {
      setProgress(entry.id, 0, "Na fila");
    }

    try {
      const result = await window.montahd.startDownload(selectedRoot, entries);
      const okCount = result.results.filter((item) => item.ok).length;
      setSummary(
        `Concluído: ${okCount}/${result.results.length} jogo(s) instalados.`,
        okCount === result.results.length ? "ok" : "error",
      );
    } catch (error) {
      setSummary(
        error instanceof Error ? error.message : "Erro durante o download.",
        "error",
      );
    } finally {
      downloadBtn.disabled = false;
      cancelBtn.classList.add("hidden");
      updateDownloadButton();
    }
  });

  cancelBtn.addEventListener("click", async () => {
    await window.montahd.cancelDownload();
    setSummary("Download cancelado.", "error");
    cancelBtn.classList.add("hidden");
    downloadBtn.disabled = false;
  });

  window.montahd.onDownloadProgress((event) => {
    if (event.status === "downloading") {
      const pct =
        event.totalBytes > 0 ? (event.downloadedBytes / event.totalBytes) * 100 : 0;
      setProgress(
        event.entryId,
        pct,
        `${formatBytes(event.downloadedBytes)} / ${formatBytes(event.totalBytes)}`,
      );
    } else if (event.status === "verifying") {
      setProgress(event.entryId, 92, "Verificando integridade…");
    } else if (event.status === "extracting") {
      setProgress(event.entryId, 96, "Descompactando…");
    } else if (event.status === "installing") {
      const pct =
        event.totalBytes > 0 ? (event.downloadedBytes / event.totalBytes) * 100 : 0;
      setProgress(
        event.entryId,
        Math.max(pct, 90),
        `Instalando ${formatBytes(event.downloadedBytes)} / ${formatBytes(event.totalBytes)}`,
      );
    } else if (event.status === "done") {
      setProgress(event.entryId, 100, "Concluído", "done");
    } else if (event.status === "error") {
      setProgress(event.entryId, 100, event.error ?? "Erro", "error");
    }
  });

  window.montahd.onDownloadComplete(({ results }) => {
    const okCount = results.filter((item) => item.ok).length;
    setSummary(
      `Concluído: ${okCount}/${results.length} jogo(s) instalados.`,
      okCount === results.length ? "ok" : "error",
    );
    cancelBtn.classList.add("hidden");
    downloadBtn.disabled = false;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
