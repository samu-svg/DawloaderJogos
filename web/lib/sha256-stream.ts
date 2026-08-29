import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/** SHA-256 incremental: hasheia o arquivo em fatias sem carregar dezenas de GB. */
export class Sha256 {
  private readonly hasher = sha256.create();

  update(chunk: Uint8Array): this {
    this.hasher.update(chunk);
    return this;
  }

  digestHex(): string {
    return bytesToHex(this.hasher.digest());
  }
}
