import assert from "node:assert/strict";
import { test } from "node:test";
import {
  digitsOnly,
  formatCpfCnpj,
  isValidCnpj,
  isValidCpf,
  isValidCpfCnpj,
} from "./cpf-cnpj.ts";

test("CPF válido e inválido", () => {
  assert.equal(isValidCpf("390.533.447-05"), true);
  assert.equal(isValidCpf("39053344705"), true);
  assert.equal(isValidCpf("11111111111"), false);
  assert.equal(isValidCpf("39053344700"), false);
});

test("CNPJ válido e inválido", () => {
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("11222333000181"), true);
  assert.equal(isValidCnpj("00000000000000"), false);
});

test("CPF ou CNPJ", () => {
  assert.equal(isValidCpfCnpj("39053344705"), true);
  assert.equal(isValidCpfCnpj("11222333000181"), true);
  assert.equal(isValidCpfCnpj("123"), false);
});

test("formatação", () => {
  assert.equal(digitsOnly("390.533.447-05"), "39053344705");
  assert.equal(formatCpfCnpj("39053344705"), "390.533.447-05");
  assert.equal(formatCpfCnpj("11222333000181"), "11.222.333/0001-81");
});
