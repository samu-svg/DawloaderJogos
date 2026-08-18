/** @typedef {import('../src/shared/manifest').Manifest} Manifest */
/** @typedef {import('../src/shared/manifest').ResolvedManifestEntry} ResolvedManifestEntry */

function init() {
  if (!window.dawloader) {
    document.body.innerHTML =
      '<div style="padding:24px;font-family:Segoe UI,sans-serif;color:#f4f4f5;background:#0a0a0a;min-height:100vh">' +
      "<h1>Dawloader</h1>" +
      "<p>Não foi possível iniciar a interface. Reinstale o aplicativo ou execute a versão mais recente.</p>" +
      "</div>";
    return;
  }

  const baseUrlInput = document.getElementById("base-url");
  const slugInput = document.getElementById("slug");
  const loadBtn = document.getElementById("load-btn");
  const loadError = document.getElementById("load-error");
  const manifestSection = document.getElementById("manifest-section");
  const portfolioTitle = document.getElementById("portfolio-title");
  const portfolioMeta = document.getElementById("portfolio-meta");
  const selectFolderBtn = document.getElementById("select-folder-btn");
  const rootPath = document.getElementById("root-path");
  const entriesBody = document.getElementById("entries-body");
  const selectAll = document.getElementById("select-all");
  const downloadBtn = document.getElementById("download-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const summary = document.getElementById("summary");

  if (
    !baseUrlInput ||
    !slugInput ||
    !loadBtn ||
    !loadError ||
    !manifestSection ||
    !portfolioTitle ||
    !portfolioMeta ||
    !selectFolderBtn ||
    !rootPath ||
    !entriesBody ||
    !selectAll ||
    !downloadBtn ||
    !cancelBtn ||
    !summary
  ) {
    document.body.innerHTML =
      '<div style="padding:24px;font-family:Segoe UI,sans-serif;color:#f4f4f5;background:#0a0a0a">' +
      "<p>Erro ao carregar a interface. Arquivos do app incompletos.</p></div>";
    return;
  }

  /** @type {Manifest | null} */
  let manifest = null;
  /** @type {string[] | null} */
  let pendingEntryFilter = null;
  /** @type {string | null} */
  let selectedRoot = null;
  /** @type {Map<string, HTMLElement>} */
  const statusCells = new Map();

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
    statusCells.clear();

    for (const entry of entries) {
      const row = document.createElement("tr");

      const checkCell = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.entryId = entry.id;
      checkbox.checked = allChecked || !entry.optional;
      checkbox.addEventListener("change", updateDownloadButton);
      checkCell.appendChild(checkbox);

      const labelCell = document.createElement("td");
      labelCell.textContent = entry.label;
      if (entry.optional) {
        const tag = document.createElement("span");
        tag.className = "muted";
        tag.textContent = " · opcional";
        labelCell.appendChild(tag);
      }

      const typeCell = document.createElement("td");
      typeCell.textContent = groupLabel(entry.group);

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
      statusCell.className = "status muted";
      statusCell.textContent = "Aguardando";
      statusCells.set(entry.id, statusCell);

      row.append(checkCell, labelCell, typeCell, destCell, sizeCell, statusCell);
      entriesBody.appendChild(row);
    }

    updateDownloadButton();
  }

  loadBtn.addEventListener("click", () => {
    void loadManifest();
  });

  async function applyCatalogLaunch(launch) {
    /** @type {HTMLInputElement} */ (baseUrlInput).value = launch.baseUrl;
    /** @type {HTMLInputElement} */ (slugInput).value = launch.slug;
    pendingEntryFilter = launch.entryIds?.length ? launch.entryIds : null;
    await loadManifest();
  }

  window.dawloader.onCatalogLaunch((launch) => {
    void applyCatalogLaunch(launch);
  });

  void window.dawloader.consumeCatalogLaunch().then((launch) => {
    if (launch) void applyCatalogLaunch(launch);
  });

  async function loadManifest() {
    loadError.classList.add("hidden");
    loadBtn.disabled = true;
    loadBtn.textContent = "Carregando...";

    try {
      manifest = await window.dawloader.fetchManifest(
        /** @type {HTMLInputElement} */ (baseUrlInput).value.trim(),
        /** @type {HTMLInputElement} */ (slugInput).value.trim(),
      );

      let entries = manifest.entries;
      const entryFilter = pendingEntryFilter;
      pendingEntryFilter = null;

      if (entryFilter?.length) {
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
      renderEntries(manifest.entries, { allChecked: Boolean(entryFilter?.length) });
      manifestSection.classList.remove("hidden");
      summary.textContent = selectedRoot
        ? ""
        : "Escolha a pasta de destino para liberar o download.";
    } catch (error) {
      loadError.textContent =
        error instanceof Error ? error.message : "Erro ao carregar manifesto.";
      loadError.classList.remove("hidden");
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = "Carregar manifesto";
    }
  }

  selectFolderBtn.addEventListener("click", async () => {
    const folder = await window.dawloader.selectFolder();
    if (!folder) return;
    selectedRoot = folder;
    rootPath.textContent = folder;
    summary.textContent = "";
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

    const confirmed = confirm(
      `Baixar ${entries.length} jogo(s)?\n\n${preview}\n\nArquivos .zip são descompactados automaticamente na pasta de destino.`,
    );
    if (!confirmed) return;

    downloadBtn.disabled = true;
    cancelBtn.classList.remove("hidden");
    summary.textContent = "Download em andamento...";

    for (const entry of entries) {
      const cell = statusCells.get(entry.id);
      if (cell) {
        cell.className = "status muted";
        cell.textContent = "Na fila";
      }
    }

    try {
      const result = await window.dawloader.startDownload(selectedRoot, entries);
      const okCount = result.results.filter((item) => item.ok).length;
      summary.textContent = `Concluído: ${okCount}/${result.results.length} jogo(s) instalados.`;
    } catch (error) {
      summary.textContent =
        error instanceof Error ? error.message : "Erro durante o download.";
    } finally {
      downloadBtn.disabled = false;
      cancelBtn.classList.add("hidden");
      updateDownloadButton();
    }
  });

  cancelBtn.addEventListener("click", async () => {
    await window.dawloader.cancelDownload();
    summary.textContent = "Download cancelado.";
    cancelBtn.classList.add("hidden");
    downloadBtn.disabled = false;
  });

  window.dawloader.onDownloadProgress((event) => {
    const cell = statusCells.get(event.entryId);
    if (!cell) return;

    if (event.status === "downloading") {
      cell.className = "status";
      cell.textContent = `${formatBytes(event.downloadedBytes)} / ${formatBytes(event.totalBytes)}`;
    } else if (event.status === "verifying") {
      cell.className = "status";
      cell.textContent = "Verificando...";
    } else if (event.status === "extracting") {
      cell.className = "status";
      cell.textContent = "Descompactando...";
    } else if (event.status === "installing") {
      cell.className = "status";
      cell.textContent = `Instalando ${formatBytes(event.downloadedBytes)} / ${formatBytes(event.totalBytes)}`;
    } else if (event.status === "done") {
      cell.className = "status done";
      cell.textContent = "Concluído";
    } else if (event.status === "error") {
      cell.className = "status error";
      cell.textContent = event.error ?? "Erro";
    }
  });

  window.dawloader.onDownloadComplete(({ results }) => {
    const okCount = results.filter((item) => item.ok).length;
    summary.textContent = `Concluído: ${okCount}/${results.length} jogo(s) instalados.`;
    cancelBtn.classList.add("hidden");
    downloadBtn.disabled = false;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
