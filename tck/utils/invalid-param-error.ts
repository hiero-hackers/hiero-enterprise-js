// Adapted from hiero-ledger/hiero-sdk-js tck/ (Apache-2.0): key parsing and
// generation are test plumbing, kept identical so key handling matches the
// reference adapter.
import { JSONRPCErrorCode } from "json-rpc-2.0";

import { CustomError } from "./custom-error.js";

export const invalidParamError = <T>(message: string): T => {
    throw new CustomError(
        `invalid parameters: ${message}`,
        JSONRPCErrorCode.InvalidParams,
    );
};
