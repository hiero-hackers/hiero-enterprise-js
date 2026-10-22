import { validationError } from "../../../errors/index.js";

/**
 * Check that a read-only contract call names exactly one call target:
 * `functionName` or pre-encoded `rawFunctionParameters`.
 *
 * @throws {HieroError} If neither or both are supplied
 */
export function validateCallTarget(
    context: string,
    options: { functionName?: string; rawFunctionParameters?: Uint8Array },
): void {
    const hasFunctionName =
        options.functionName != null && options.functionName !== "";
    const hasRawParameters = options.rawFunctionParameters != null;

    if (!hasFunctionName && !hasRawParameters) {
        throw validationError(
            context,
            "A contract call requires either functionName or rawFunctionParameters.",
        );
    }

    if (hasFunctionName && hasRawParameters) {
        throw validationError(
            context,
            "A contract call accepts functionName or rawFunctionParameters, not both.",
        );
    }
}
