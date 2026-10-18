import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { exitQuietlyOnClosedPipe } from "../../src/cli/io";

describe("stdout closed by the reader", () => {
  it("BUG-0024 exits quietly on EPIPE and rethrows other errors", () => {
    const stream = new EventEmitter();
    const exits: number[] = [];
    exitQuietlyOnClosedPipe(stream, (code) => exits.push(code));
    stream.emit("error", Object.assign(new Error("write EPIPE"), { code: "EPIPE" }));
    expect(exits).toEqual([0]);
    expect(() => stream.emit("error", new Error("disk full"))).toThrow("disk full");
  });
});
