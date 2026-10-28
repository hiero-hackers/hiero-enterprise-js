import { AccountId, TransactionId } from "@hiero-ledger/sdk";
import { validationError } from "../../errors/index.js";
import type { TransactionOptions } from "./TransactionOptions.js";

const CONTEXT = "TransactionExecutor";

/**
 * `<shard>.<realm>.<num>@<seconds>.<nanos>`, with nanos zero-padded to 9
 * digits as `TransactionId.toString()` prints them. The optional
 * `?scheduled` and `/<nonce>` suffixes pass, so they get their own error.
 */
const FULL_ID_PATTERN = /^\d+\.\d+\.\d+@\d+\.\d{9}(|\?scheduled)(|\/\d+)$/;

/**
 * Resolve `TransactionOptions.transactionId` or `payer` into the SDK
 * `TransactionId` to set on the transaction: a transaction ID as-is, a
 * payer with a generated valid start.
 *
 * @returns The transaction ID, or `undefined` when neither is set
 * @throws {HieroError} `INPUT_INVALID` if both are set, if either comes
 *   with `regenerateTransactionId: true`, if the ID is malformed (a string
 *   must be `<shard>.<realm>.<num>@<seconds>.<nanos>` with 9-digit nanos)
 *   or carries a `scheduled` flag or a nonce, or if the payer is not a
 *   `shard.realm.num` account ID
 */
export function resolveTransactionId(
    options: TransactionOptions,
): TransactionId | undefined {
    const { transactionId: value, payer } = options;

    if (value == null && payer == null) {
        return undefined;
    }

    if (value != null && payer != null) {
        throw validationError(
            CONTEXT,
            "Set either transactionId or payer, not both: a transaction ID already names its payer.",
        );
    }

    // A set ID is locked, so the SDK would silently never regenerate it.
    if (options.regenerateTransactionId === true) {
        throw validationError(
            CONTEXT,
            "regenerateTransactionId cannot be true together with transactionId or payer: a set transaction ID is never regenerated.",
        );
    }

    const transactionId =
        value != null ? toTransactionId(value) : fromPayer(payer!);

    if (transactionId.accountId == null || transactionId.validStart == null) {
        throw validationError(
            CONTEXT,
            "transactionId must have an account ID and a valid start.",
        );
    }

    if (transactionId.scheduled || transactionId.nonce != null) {
        throw validationError(
            CONTEXT,
            "transactionId cannot carry a scheduled flag or a nonce.",
        );
    }

    assertNumericAccount("transactionId", transactionId.accountId);

    return transactionId;
}

/** Parse a full transaction ID string, or take a `TransactionId` as-is. */
function toTransactionId(value: string | TransactionId): TransactionId {
    if (value instanceof TransactionId) {
        return value;
    }

    try {
        // Check the shape first: fromString reads "0.0.5@abc.def" as valid
        // start 0 and "0.0.5@1700000000.5" as 5 ns.
        if (FULL_ID_PATTERN.test(value)) {
            return TransactionId.fromString(value);
        }
    } catch {
        // Fall through to the error below.
    }

    throw validationError(
        CONTEXT,
        `transactionId "${value}" is not a transaction ID (e.g. 0.0.5@1700000000.000000123, with 9-digit nanos). To only set who pays, use payer.`,
    );
}

/** Generate a transaction ID paid by `payer`, valid from now. */
function fromPayer(payer: string | AccountId): TransactionId {
    let accountId: AccountId;

    try {
        accountId =
            typeof payer === "string" ? AccountId.fromString(payer) : payer;
    } catch {
        throw validationError(
            CONTEXT,
            `payer "${payer}" is not an account ID (e.g. 0.0.5).`,
        );
    }

    // Check before generating: TransactionId.generate copies only
    // shard.realm.num and would drop an alias or EVM address.
    assertNumericAccount("payer", accountId);

    return TransactionId.generate(accountId);
}

/** Reject an alias or EVM-address account: the payer must be shard.realm.num. */
function assertNumericAccount(name: string, accountId: AccountId): void {
    if (accountId.aliasKey != null || accountId.evmAddress != null) {
        throw validationError(
            CONTEXT,
            `${name} must name its payer as a shard.realm.num account ID.`,
        );
    }
}
