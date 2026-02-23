/**
 * Custom error class for Hiero operations.
 * Wraps SDK and network errors with additional context.
 *
 */
export class HieroError extends Error {
    /** Machine-readable error code */
    public readonly code: string;
    /** Additional context about what operation was being performed */
    public readonly context?: string;
    /** The original error that caused this error */
    public override readonly cause?: Error;

    constructor(
        message: string,
        options: {
            code?: string;
            context?: string;
            cause?: Error;
        } = {},
    ) {
        super(message);
        this.name = "HieroError";
        this.code = options.code ?? "UNKNOWN";
        this.context = options.context;
        this.cause = options.cause;
    }
}

/**
 * Normalize any error into a HieroError.
 * If the error is already a HieroError, it is returned as-is.
 * Otherwise, it is wrapped in a new HieroError.
 *
 * @param error - The error to normalize
 * @param context - Optional context string describing the operation
 * @returns A HieroError
 */
export function normalizeError(error: unknown, context?: string): HieroError {
    if (error instanceof HieroError) {
        return error;
    }

    if (error instanceof Error) {
        // Try to extract a status code from SDK errors
        const sdkError = error as { status?: { _code?: number } };
        const code = sdkError.status?._code?.toString() ?? "SDK_ERROR";

        return new HieroError(error.message, {
            code,
            context,
            cause: error,
        });
    }

    return new HieroError(String(error), {
        code: "UNKNOWN",
        context,
    });
}
