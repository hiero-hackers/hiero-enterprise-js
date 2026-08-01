import {
    MirrorError,
    MirrorErrorCodes,
    describeValue,
} from "../errors/MirrorError.js";
import type {
    MirrorAccountResponse,
    MirrorExchangeRatesResponse,
    MirrorNetworkStakeResponse,
    MirrorNetworkSupplyResponse,
    MirrorNft,
    MirrorPageResponse,
    MirrorTokenResponse,
    MirrorTopicMessageRaw,
    MirrorTransaction,
    MirrorTransactionListResponse,
    MirrorScheduleResponse,
    MirrorTopicResponse,
    MirrorNetworkFeesResponse,
    MirrorBlock,
    MirrorContractResponse,
    MirrorContractResultDetails,
    MirrorOpcodesResponse,
    MirrorContractCallResponse,
    MirrorFeeEstimateResponse,
} from "../types/index.js";

// Top-level response assertions
export function assertPageResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorPageResponse<unknown> {
    assertObject(raw, path);
    const hasDataArray = Object.entries(raw).some(
        ([key, value]) => key !== "links" && Array.isArray(value),
    );
    if (!hasDataArray) {
        throw mismatch(path, "expected a paged array payload");
    }
}

export function assertAccountResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorAccountResponse {
    assertObject(raw, path);
    assertField(raw, "account", "string", path);
}

export function assertNftResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorNft {
    assertObject(raw, path);
    assertField(raw, "token_id", "string", path);
    assertField(raw, "serial_number", "number", path);
}

export function assertTokenResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorTokenResponse {
    assertObject(raw, path);
    assertField(raw, "token_id", "string", path);
}

export function assertTopicMessageResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorTopicMessageRaw {
    assertObject(raw, path);
    assertField(raw, "topic_id", "string", path);
    assertField(raw, "sequence_number", "number", path);
}

export function assertTransactionListResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorTransactionListResponse {
    assertObject(raw, path);
    if (!Array.isArray(raw.transactions)) {
        throw mismatch(path, "expected transactions array");
    }
}

export function assertTransactionResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorTransaction {
    assertObject(raw, path);
    assertField(raw, "transaction_id", "string", path);
}

export function assertExchangeRatesResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorExchangeRatesResponse {
    assertObject(raw, path);
    assertObject(raw.current_rate, `${path}.current_rate`);
    assertObject(raw.next_rate, `${path}.next_rate`);
}

export function assertNetworkSupplyResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorNetworkSupplyResponse {
    assertObject(raw, path);
    assertField(raw, "released_supply", "string", path);
    assertField(raw, "total_supply", "string", path);
}

export function assertNetworkStakeResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorNetworkStakeResponse {
    assertObject(raw, path);
    // A `MirrorAmount`: the lossless parse delivers it as a string whenever
    // the wire value has 16+ digits — which mainnet's does today
    // (max_stake_rewarded ≈ 6.5e17). Asserting "number" here would reject
    // every mainnet /network/stake response.
    assertAmountField(raw, "max_stake_rewarded", path);
}

export function assertScheduleResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorScheduleResponse {
    assertObject(raw, path);
    assertField(raw, "schedule_id", "string", path);
}

export function assertTopicResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorTopicResponse {
    assertObject(raw, path);
    assertField(raw, "topic_id", "string", path);
}

export function assertNetworkFeesResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorNetworkFeesResponse {
    assertObject(raw, path);
    if (!Array.isArray(raw.fees)) {
        throw mismatch(path, "expected fees array");
    }
}

export function assertBlockResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorBlock {
    assertObject(raw, path);
    assertField(raw, "hash", "string", path);
    assertField(raw, "number", "number", path);
}

export function assertContractResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorContractResponse {
    assertObject(raw, path);
    assertField(raw, "contract_id", "string", path);
}

export function assertContractResultResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorContractResultDetails {
    assertObject(raw, path);
    // `result` is the one field present on every contract result, whether
    // the execution came from HAPI or a wrapped ethereum transaction.
    assertField(raw, "result", "string", path);
}

export function assertOpcodesResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorOpcodesResponse {
    assertObject(raw, path);
    if (!Array.isArray(raw.opcodes)) {
        throw mismatch(path, "expected opcodes array");
    }
}

export function assertContractCallResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorContractCallResponse {
    assertObject(raw, path);
    assertField(raw, "result", "string", path);
}

export function assertFeeEstimateResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorFeeEstimateResponse {
    assertObject(raw, path);
    assertField(raw, "total", "number", path);
}

// Primitive assertions
function assertObject(
    value: unknown,
    path: string,
): asserts value is Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw mismatch(path, "expected a JSON object");
    }
}

function assertField(
    obj: Record<string, unknown>,
    field: string,
    expectedType: "string" | "number" | "boolean",
    path: string,
): void {
    const value: unknown = Reflect.get(obj, field);
    if (typeof value !== expectedType) {
        throw mismatch(
            `${path}.${field}`,
            `expected ${expectedType}, got ${describeValue(value)}`,
        );
    }
}

/**
 * Assert a `MirrorAmount` field. The invariant is the same for both arms —
 * amounts are whole (optionally negative) integers:
 *
 * - number arm: must be an integer (`Number.isInteger`, which also rules
 *   out `NaN`/`Infinity` — unreachable via JSON.parse, but the predicate is
 *   free). A fractional number like `1.5` is valid JSON and must not pass.
 * - string arm: must be all digits. This arm is machine-generated by the
 *   lossless parse (`utils/LosslessJson.ts`, wire integers of 16+ digits),
 *   so unlike the free-text `assertField` checks its *content* is part of
 *   the schema — any other string means the payload itself was malformed.
 */
function assertAmountField(
    obj: Record<string, unknown>,
    field: string,
    path: string,
): void {
    const value: unknown = Reflect.get(obj, field);
    // The string arm is a bare integer quoted by the lossless parse — see
    // utils/LosslessJson.ts for the quoting contract. Sign allowed here:
    // transfer debit legs are negative.
    const isWholeAmount =
        typeof value === "number"
            ? Number.isInteger(value)
            : typeof value === "string" && /^-?\d+$/.test(value);
    if (!isWholeAmount) {
        throw mismatch(
            `${path}.${field}`,
            `expected an integer amount (number or string), got ${describeValue(value)}`,
        );
    }
}

function mismatch(path: string, detail: string): MirrorError {
    return new MirrorError(
        `Mirror node response schema mismatch at ${path}: ${detail}.`,
        { code: MirrorErrorCodes.MirrorNodeSchemaMismatch, context: path },
    );
}
