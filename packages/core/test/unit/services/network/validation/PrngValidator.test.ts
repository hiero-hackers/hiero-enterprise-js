import { describe, it, expect } from "vitest";
import { PrngValidator } from "../../../../../src/services/network/validation/index.js";

describe("PrngValidator", () => {
    const validator = new PrngValidator();

    it.each([undefined, 1, 100, 2_147_483_647])("accepts range %s", (range) => {
        expect(() => validator.validate({ range })).not.toThrow();
    });

    it.each([0, -5, 2.5, 2_147_483_648, Infinity])(
        "rejects range %s",
        (range) => {
            expect(() => validator.validate({ range })).toThrow(
                /range must be an integer from 1 to 2147483647/,
            );
        },
    );
});
