/** JSON-RPC code the TCK reads as "the network returned a status". */
export const HEDERA_ERROR = -32001;

/** A TCK method or parameter enterprise-core has no equivalent for. */
export class NotSupportedError extends Error {}

/**
 * Stop handling a request core can't express. The server answers with the
 * TCK's `NOT_IMPLEMENTED` result, so the test is skipped (not failed), and
 * logs the gap so runs can list them.
 */
export function notSupported(what: string): never {
    throw new NotSupportedError(`not supported by enterprise-core: ${what}`);
}
