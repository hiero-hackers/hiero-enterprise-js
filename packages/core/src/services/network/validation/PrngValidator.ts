import { validationError } from "../../../errors/index.js";
import type { PrngOptions } from "../operations/index.js";

/** Largest `range` the network accepts (a signed 32-bit integer). */
const MAX_RANGE = 2_147_483_647;

/**
 * Validates `PrngOptions` before they reach the SDK.
 */
export class PrngValidator {
    /**
     * @throws {HieroError} If `range` is given and is not an integer in
     *   `[1, 2147483647]`
     */
    validate(options: PrngOptions): void {
        if (options.range == null) return;
        if (
            !Number.isInteger(options.range) ||
            options.range < 1 ||
            options.range > MAX_RANGE
        ) {
            throw validationError(
                "PrngValidator",
                `range must be an integer from 1 to ${MAX_RANGE}, got ${options.range}.`,
            );
        }
    }
}
