import test from "node:test";
import assert from "node:assert/strict";
import {
  LAUNCH_IFRAME_CLEANUP_MS,
  launchMontaHdProtocol,
  type LaunchMontaHdHost,
} from "./launch-montahd.ts";

function createHost() {
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const appended: unknown[] = [];
  const iframe = {
    style: { display: "" },
    src: "",
    attributes: {} as Record<string, string>,
    removed: false,
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    },
    remove() {
      this.removed = true;
    },
  };

  const host: LaunchMontaHdHost = {
    createElement(tagName) {
      assert.equal(tagName, "iframe");
      return iframe;
    },
    body: {
      appendChild(node) {
        appended.push(node);
      },
    },
    setTimeout(fn, ms) {
      timers.push({ fn, ms });
      return timers.length;
    },
  };

  return { host, iframe, appended, timers };
}

test("abre o protocolo via iframe oculto e remove depois", () => {
  const { host, iframe, appended, timers } = createHost();
  const deepLink = "montahd://install/jogos360/sess.abc";

  launchMontaHdProtocol(deepLink, host);

  assert.equal(iframe.src, deepLink);
  assert.equal(iframe.style.display, "none");
  assert.equal(iframe.attributes.hidden, "");
  assert.equal(iframe.attributes["aria-hidden"], "true");
  assert.equal(appended.length, 1);
  assert.equal(appended[0], iframe);
  assert.equal(iframe.removed, false);
  assert.equal(timers.length, 1);
  assert.equal(timers[0]?.ms, LAUNCH_IFRAME_CLEANUP_MS);

  timers[0]?.fn();
  assert.equal(iframe.removed, true);
});

test("nao faz nada sem window/document (SSR)", () => {
  launchMontaHdProtocol("montahd://install/jogos360");
});

test("ignora URLs que nao sao montahd://", () => {
  const { host, appended, timers } = createHost();
  launchMontaHdProtocol("https://example.com", host);
  launchMontaHdProtocol("/assinar", host);
  assert.equal(appended.length, 0);
  assert.equal(timers.length, 0);
});

test("nao faz nada se o body nao existe", () => {
  const { host, appended } = createHost();
  host.body = null;
  launchMontaHdProtocol("montahd://install/jogos360", host);
  assert.equal(appended.length, 0);
});
