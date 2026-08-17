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
    if (group === "pasta-local") return "Zip (TeraBox)";
    return group ?? "—";
  }

  function isZipPackage(entry) {
    return (
      entry.packageFormat === "zip" ||
      entry.group === "pasta-local" ||
      entry.downloadUrl.startsWith("local://")
    );
  }

  function isLocalImport(entry) {
    return isZipPackage(entry);
  }

  function getDestinationInput(entryId) {
    return document.querySelector(`input[data-destination-for="${entryId}"]`);
  }

  function selectedEntriesWithDestinations() {
    if (!manifest) return [];

    const selectedIds = new Set(
      [...entriesBody.querySelectorAll('input[type="checkbox"][data-entry-id]')]
        .filter((input) => input.checked)
        .map((input) => input.dataset.entryId),
    );

    return manifest.entries
      .filter((entry) => selectedIds.has(entry.id))
      .filter((entry) => !isLocalImport(entry))
      .map((entry) => {
        const input = getDestinationInput(entry.id);
        const destination = input?.value.trim() || entry.destination;
        return { ...entry, destination };
      });
  }

  function updateDownloadButton() {
    const hasSelection = [
      ...entriesBody.querySelectorAll('input[type="checkbox"][data-entry-id]'),
    ].some((input) => input.checked);
    downloadBtn.disabled = !selectedRoot || !hasSelection;
  }

  function renderEntries(entries) {
    entriesBody.innerHTML = "";
    statusCells.clear();

    for (const entry of entries) {
      const row = document.createElement("tr");
      const localImport = isLocalImport(entry);

      const checkCell = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.entryId = entry.id;
      checkbox.checked = !entry.optional && !localImport;
      checkbox.disabled = localImport;
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
      if (localImport) {
        const tag = document.createElement("span");
        tag.className = "muted";
        tag.textContent = " · zip / TeraBox";
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
      sizeCell.textContent = localImport ? "Zip" : formatBytes(entry.sizeBytes);

      const statusCell = document.createElement("td");
      statusCell.className = "status muted";
      if (localImport) {
        const wrap = document.createElement("div");
        wrap.className = "import-actions";

        if (entry.sourceUrl) {
          const teraboxBtn = document.createElement("button");
          teraboxBtn.type = "button";
          teraboxBtn.className = "btn-import secondary";
          teraboxBtn.textContent = "Abrir TeraBox";
          teraboxBtn.addEventListener("click", () =>
            void window.dawloader.openExternalUrl(entry.sourceUrl),
          );
          wrap.appendChild(teraboxBtn);
        }

        const zipBtn = document.createElement("button");
        zipBtn.type = "button";
        zipBtn.className = "btn-import";
        zipBtn.textContent = "Instalar zip";
        zipBtn.addEventListener("click", () => void handleInstall(entry, statusCell, "zip"));
        wrap.appendChild(zipBtn);

        const folderBtn = document.createElement("button");
        folderBtn.type = "button";
        folderBtn.className = "btn-import secondary";
        folderBtn.textContent = "Pasta";
        folderBtn.addEventListener("click", () =>
          void handleInstall(entry, statusCell, "folder"),
        );
        wrap.appendChild(folderBtn);

        statusCell.appendChild(wrap);
      } else {
        statusCell.textContent = "Aguardando";
      }
      statusCells.set(entry.id, statusCell);

      row.append(checkCell, labelCell, typeCell, destCell, sizeCell, statusCell);
      entriesBody.appendChild(row);
    }

    updateDownloadButton();
  }

  async function handleInstall(entry, statusCell, mode) {
    if (!selectedRoot) {
      alert("Escolha primeiro a pasta raiz do HD.");
      return;
    }

    if (mode === "zip" && entry.sourceUrl) {
      const openFirst = confirm(
        `1. Baixe o .zip no TeraBox (navegador).\n2. Depois escolha o arquivo baixado aqui.\n\nAbrir o link do TeraBox agora?`,
      );
      if (openFirst) {
        await window.dawloader.openExternalUrl(entry.sourceUrl);
      }
    }

    let sourcePath = null;
    if (mode === "zip") {
      sourcePath = await window.dawloader.selectZipFile();
    } else {
      sourcePath = await window.dawloader.selectFolder();
    }
    if (!sourcePath) return;

    const input = getDestinationInput(entry.id);
    const destination = input?.value.trim() || entry.destination;

    const sourceLabel = mode === "zip" ? "Zip" : "Pasta";
    const confirmed = confirm(
      `${sourceLabel}:\n${sourcePath}\n\nInstalar em:\n${selectedRoot}\\${destination.replace(/\//g, "\\")}\n\nO zip será descompactado automaticamente. Subpastas são preservadas.`,
    );
    if (!confirmed) return;

    statusCell.className = "status muted";
    statusCell.textContent = mode === "zip" ? "Descompactando..." : "Instalando...";
    summary.textContent = `Instalando ${entry.label}...`;

    const result = await window.dawloader.importLocalPackage({
      rootDir: selectedRoot,
      sourcePath,
      entryId: entry.id,
      label: entry.label,
      destination,
    });

    if (result.ok) {
      summary.textContent = `Instalado: ${result.filesCopied} arquivo(s) (${formatBytes(result.bytesCopied)}).`;
    } else {
      summary.textContent = result.error ?? "Erro na instalação.";
    }
  }

  loadBtn.addEventListener("click", async () => {
    loadError.classList.add("hidden");
    loadBtn.disabled = true;
    loadBtn.textContent = "Carregando...";

    try {
      manifest = await window.dawloader.fetchManifest(
        /** @type {HTMLInputElement} */ (baseUrlInput).value.trim(),
        /** @type {HTMLInputElement} */ (slugInput).value.trim(),
      );
      portfolioTitle.textContent = manifest.portfolio.title;
      portfolioMeta.textContent = `${manifest.entries.length} arquivo(s) · ${formatBytes(manifest.totalBytes)} · expira ${new Date(manifest.expiresAt).toLocaleString("pt-BR")}`;
      renderEntries(manifest.entries);
      manifestSection.classList.remove("hidden");
      summary.textContent = "";
    } catch (error) {
      loadError.textContent =
        error instanceof Error ? error.message : "Erro ao carregar manifesto.";
      loadError.classList.remove("hidden");
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = "Carregar manifesto";
    }
  });

  selectFolderBtn.addEventListener("click", async () => {
    const folder = await window.dawloader.selectFolder();
    if (!folder) return;
    selectedRoot = folder;
    rootPath.textContent = folder;
    updateDownloadButton();
  });

  selectAll.addEventListener("change", () => {
    for (const input of entriesBody.querySelectorAll(
      'input[type="checkbox"][data-entry-id]',
    )) {
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
      `Confirma baixar ${entries.length} arquivo(s)?\n\n${preview}\n\nNada será executado — apenas copiado.`,
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
      summary.textContent = `Concluído: ${okCount}/${result.results.length} arquivo(s) baixados.`;
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

    if (
      event.status === "downloading" ||
      event.status === "importing" ||
      event.status === "extracting"
    ) {
      cell.className = "status";
      cell.textContent = `${formatBytes(event.downloadedBytes)} / ${formatBytes(event.totalBytes)}`;
    } else if (event.status === "verifying") {
      cell.className = "status";
      cell.textContent = "Verificando hash...";
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
    summary.textContent = `Concluído: ${okCount}/${results.length} arquivo(s) baixados.`;
    cancelBtn.classList.add("hidden");
    downloadBtn.disabled = false;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
