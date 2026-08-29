/** Mensagem clara para erros comuns de disco ao baixar/descompactar jogos. */
export function formatFsError(error: unknown): string {
  const code =
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : null;

  const message = error instanceof Error ? error.message : String(error);

  if (code === "ENOSPC" || /enospc|no space left on device/i.test(message)) {
    return (
      "Espaço insuficiente no disco. Jogos até 4 GB instalam no HD; pacotes maiores usam o PC " +
      "(FAT32 do Xbox 360 não aceita um arquivo acima de 4 GB). " +
      "Libere espaço no HD ou no Windows, conforme o caso, e tente de novo. " +
      "O download retoma de onde parou."
    );
  }

  if (code === "EFBIG" || /file too large|entity too large/i.test(message)) {
    return (
      "Um arquivo extraído passa de 4 GB e o HD do Xbox 360 (FAT32) não aceita. " +
      "O zip é processado no PC, mas cada arquivo copiado para o HD precisa ter menos de 4 GB."
    );
  }

  if (code === "EACCES" || code === "EPERM") {
    return "Sem permissão para gravar na pasta escolhida. Escolha outra pasta ou execute o app como administrador.";
  }

  return message;
}
