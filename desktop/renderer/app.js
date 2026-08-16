/** @typedef {import('../src/shared/manifest').Manifest} Manifest */
/** @typedef {import('../src/shared/manifest').ResolvedManifestEntry} ResolvedManifestEntry */

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

function updateDownloadButton() {
  const hasSelection = [...entriesBody.querySelectorAll('input[type="checkbox"]')].some(
    (input) => input.checked,
  );
  downloadBtn.disabled = !selectedRoot || !hasSelection;
}

function renderEntries(entries) {
  entriesBody.innerHTML = "";
  statusCells.clear();

  for (const entry of entries) {
    const row = document.createElement("tr");

    const checkCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.entryId = entry.id;
    checkbox.checked = !entry.optional;
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

    const destCell = document.createElement("td");
    destCell.className = "mono";
    destCell.textContent = entry.destination;

    const sizeCell = document.createElement("td");
    sizeCell.textContent = formatBytes(entry.sizeBytes);

    const statusCell = document.createElement("td");
    statusCell.className = "status muted";
    statusCell.textContent = "Aguardando";
    statusCells.set(entry.id, statusCell);

    row.append(checkCell, labelCell, destCell, sizeCell, statusCell);
    entriesBody.appendChild(row);
  }

  updateDownloadButton();
}

loadBtn.addEventListener("click", async () => {
  loadError.classList.add("hidden");
  loadBtn.disabled = true;
  loadBtn.textContent = "Carregando...";

  try {
    manifest = await window.dawloader.fetchManifest(
      baseUrlInput.value.trim(),
      slugInput.value.trim(),
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
  for (const input of entriesBody.querySelectorAll('input[type="checkbox"]')) {
    input.checked = selectAll.checked;
  }
  updateDownloadButton();
});

downloadBtn.addEventListener("click", async () => {
  if (!manifest || !selectedRoot) return;

  const selectedIds = new Set(
    [...entriesBody.querySelectorAll('input[type="checkbox"]')]
      .filter((input) => input.checked)
      .map((input) => input.dataset.entryId),
  );

  const entries = manifest.entries.filter((entry) => selectedIds.has(entry.id));
  if (entries.length === 0) return;

  const confirmed = confirm(
    `Confirma baixar ${entries.length} arquivo(s) para:\n${selectedRoot}\n\nNada será executado — apenas copiado.`,
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

  if (event.status === "downloading") {
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
