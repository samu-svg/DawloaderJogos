import test from "node:test";
import assert from "node:assert/strict";
import {
  LAUNCH_ANCHOR_CLEANUP_MS,
  launchMontaHdProtocol,
  type LaunchMontaHdHost,
} from "./launch-montahd.ts";

function createHost() {
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const appended: unknown[] = [];
  const anchor = {
    style: { display: "" },
    href: "",
    attributes: {} as Record<string, string>,
    clicked: false,
    removed: false,
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    },
    click() {
      this.clicked = true;
    },
    remove() {
      this.removed = true;
    },
  };

  const host: LaunchMontaHdHost = {
    createElement(tagName) {
      assert.equal(tagName, "a");
      return anchor;
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

  return { host, anchor, appended, timers };
}

test("abre o protocolo via ancora oculta, clica e remove depois", () => {
  const { host, anchor, appended, timers } = createHost();
  const deepLink = "montahd://install/jogos360/sess.abc";

  launchMontaHdProtocol(deepLink, host);

  assert.equal(anchor.href, deepLink);
  assert.equal(anchor.style.display, "none");
  assert.equal(anchor.attributes.hidden, "");
  assert.equal(anchor.attributes["aria-hidden"], "true");
  assert.equal(anchor.clicked, true);
  assert.equal(appended.length, 1);
  assert.equal(appended[0], anchor);
  assert.equal(anchor.removed, false);
  assert.equal(timers.length, 1);
  assert.equal(timers[0]?.ms, LAUNCH_ANCHOR_CLEANUP_MS);

  timers[0]?.fn();
  assert.equal(anchor.removed, true);
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
