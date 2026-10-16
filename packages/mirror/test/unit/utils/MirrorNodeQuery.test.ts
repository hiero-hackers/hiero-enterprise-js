import { describe, it, expect } from "vitest";
import {
    appendQuery,
    transactionIdSegment,
} from "../../../src/utils/MirrorNodeQuery.js";

describe("appendQuery", () => {
    it("returns the path unchanged when no params are present", () => {
        expect(appendQuery("/api/v1/transactions", {})).toBe(
            "/api/v1/transactions",
        );
        expect(appendQuery("/api/v1/transactions", { limit: undefined })).toBe(
            "/api/v1/transactions",
        );
    });

    it("starts with `?` when the path has no query string", () => {
        expect(appendQuery("/api/v1/nfts", { limit: 10 })).toBe(
            "/api/v1/nfts?limit=10",
        );
    });

    it("continues with `&` when the path already has a query string", () => {
        expect(
            appendQuery("/api/v1/transactions?account.id=0.0.1", {
                limit: 10,
            }),
        ).toBe("/api/v1/transactions?account.id=0.0.1&limit=10");
    });

    it("omits undefined values but keeps the rest", () => {
        expect(
            appendQuery("/p", { a: undefined, b: 2, c: undefined, d: "x" }),
        ).toBe("/p?b=2&d=x");
    });

    it("expands a range object into repeated key=op:value params", () => {
        expect(
            appendQuery("/p", {
                timestamp: { gte: "1700000000.0", lt: "1700086400.0" },
            }),
        ).toBe("/p?timestamp=gte:1700000000.0&timestamp=lt:1700086400.0");
    });

    it("expands an array into one repeated param per element", () => {
        expect(appendQuery("/p", { "account.id": ["0.0.1", "0.0.2"] })).toBe(
            "/p?account.id=0.0.1&account.id=0.0.2",
        );
    });

    it("skips undefined bounds inside a range object", () => {
        expect(
            appendQuery("/p", { timestamp: { gte: "1.0", lt: undefined } }),
        ).toBe("/p?timestamp=gte:1.0");
    });

    it("percent-encodes reserved characters in values", () => {
        expect(appendQuery("/p", { q: "a b&c" })).toBe("/p?q=a%20b%26c");
    });
});

describe("transactionIdSegment", () => {
    it("rewrites the SDK form to the mirror node form", () => {
        expect(transactionIdSegment("0.0.10924172@1792170607.753000756")).toBe(
            "0.0.10924172-1792170607-753000756",
        );
    });

    it.each([
        "0.0.10924172-1792170607-753000756",
        "0x6317a8117f9966f5d384d33ce9d750d68942fee509f467a37f3f181f0b4bc587",
    ])("passes %s through", (id) => {
        expect(transactionIdSegment(id)).toBe(id);
    });

    it("encodes an SDK ID with a suffix instead of rewriting it", () => {
        expect(transactionIdSegment("0.0.5@1700000000.1?scheduled")).toBe(
            "0.0.5%401700000000.1%3Fscheduled",
        );
    });
});
