import assert from "node:assert/strict";
import test from "node:test";
import { DownloadSession } from "./download-control.ts";

function fakeItem(id: string) {
  return {
    entry: {
      id,
      label: id,
      destination: `${id}.rar`,
      sizeBytes: 10,
      downloadUrl: "https://example.com/file",
    },
    destPath: `D:/HD/${id}.rar`,
  };
}

test("pauseEntry marca e aborta só aquele jogo", () => {
  const session = new DownloadSession();
  session.registerItems([fakeItem("a"), fakeItem("b")]);
  const signalA = session.signalFor("a");
  session.signalFor("b");
  session.pauseEntry("a");
  assert.equal(session.isPaused("a"), true);
  assert.equal(session.isPaused("b"), false);
  assert.equal(signalA.aborted, true);
});

test("pauseAll bloqueia a fila e pausa todos os itens conhecidos", () => {
  const session = new DownloadSession();
  session.registerItems([fakeItem("a"), fakeItem("b")]);
  session.signalFor("a");
  session.pauseAll();
  assert.equal(session.queueBlocked, true);
  assert.equal(session.isPaused("a"), true);
  assert.equal(session.isPaused("b"), true);
});

test("requeue tira da pausa e recoloca na fila extra", () => {
  const session = new DownloadSession();
  const item = fakeItem("abadavatar");
  session.registerItems([item, fakeItem("jogo")]);
  session.pauseEntry("abadavatar");
  assert.equal(session.requeue("abadavatar"), true);
  assert.equal(session.isPaused("abadavatar"), false);
  assert.equal(session.extraQueue.length, 1);
  assert.equal(session.extraQueue[0]?.entry.id, "abadavatar");
});

test("cancelEntry não deixa o jogo pausado", () => {
  const session = new DownloadSession();
  session.registerItems([fakeItem("a")]);
  session.pauseEntry("a");
  session.cancelEntry("a");
  assert.equal(session.isCancelled("a"), true);
  assert.equal(session.isPaused("a"), false);
});
