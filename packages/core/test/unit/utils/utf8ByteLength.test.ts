import { describe, it, expect } from "vitest";
import { utf8ByteLength } from "../../../src/utils/index.js";

describe("utf8ByteLength", () => {
    it("counts one byte per ASCII character", () => {
        expect(utf8ByteLength("")).toBe(0);
        expect(utf8ByteLength("a".repeat(100))).toBe(100);
    });

    it.each([
        ["2-byte", "é", 50],
        ["3-byte", "€", 33],
        ["4-byte", "🚀", 25],
    ])("counts %s characters by their UTF-8 bytes", (_, char, count) => {
        const bytes = new TextEncoder().encode(char).length;

        expect(utf8ByteLength(char.repeat(count))).toBe(bytes * count);
    });

    it("counts multi-byte characters at the 100-byte limit", () => {
        expect(utf8ByteLength("é".repeat(50))).toBe(100);
        expect(utf8ByteLength("🚀".repeat(25))).toBe(100);
        expect(utf8ByteLength("é".repeat(49) + "€")).toBe(101);
        expect(utf8ByteLength("a" + "🚀".repeat(25))).toBe(101);
    });

    it("matches Buffer.byteLength", () => {
        const value = "café ℏ 🎉 漢字";

        expect(utf8ByteLength(value)).toBe(Buffer.byteLength(value, "utf8"));
    });
});
