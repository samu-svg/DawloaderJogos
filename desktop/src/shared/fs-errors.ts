const DISCONNECT_CODES = new Set([
  "ENOENT",
  "EIO",
  "ENXIO",
  "ENODEV",
  "UNKNOWN",
]);

const DISCONNECT_MESSAGE =
  /device is not ready|not ready|cannot find the (path|drive)|sistema não pode encontrar|unidade (não está|n[aã]o est[aá])|volume does not contain|no such file or directory|unknown error, (write|open|read|stat|unlink)|the specified network name|o dispositivo n[aã]o est[aá] pronto/i;

function errorCode(error: unknown): string | null {
  if (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** HD/USB arrancado, letra do disco sumiu ou unidade inacessível. */
export function isHdDisconnectError(error: unknown): boolean {
  const code = errorCode(error);
  if (code && DISCONNECT_CODES.has(code)) return true;
  return DISCONNECT_MESSAGE.test(errorText(error));
}

/** Mensagem clara para erros comuns de disco ao baixar/descompactar jogos. */
export function formatFsError(error: unknown): string {
  const code = errorCode(error);
  const message = errorText(error);

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

  if (isHdDisconnectError(error)) {
    return (
      "O HD foi desconectado. Reconecte o cabo USB — o MontaHD retoma o download sozinho."
    );
  }

  if (code === "EACCES" || code === "EPERM") {
    if (/mkdir ['"]?[a-zA-Z]:\\?['"]?/i.test(message)) {
      return (
        "O Windows recusou gravar na raiz do disco (ex.: D:\\). " +
        "Baixe a versão nova no site (montahds.app) e instale por cima desta."
      );
    }
    return "Sem permissão para gravar na pasta escolhida. Escolha outra pasta ou execute o app como administrador.";
  }

  return message;
}
