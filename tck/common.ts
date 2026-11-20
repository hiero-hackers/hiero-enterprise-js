import type { PrivateKey } from "@hiero-ledger/sdk";
import { Hbar } from "@hiero-ledger/sdk";
import type { TransactionOptions } from "@hiero-hackers/enterprise-core";
import { getKeyFromString } from "./utils/key.js";
import { notSupported } from "./errors.js";

/** The `commonTransactionParams` every TCK transaction request may carry. */
export interface CommonTransactionParams {
    readonly transactionId?: string;
    readonly maxTransactionFee?: number;
    readonly validTransactionDuration?: number;
    readonly memo?: string;
    readonly regenerateTransactionId?: boolean;
    readonly signers?: string[];
    readonly highVolume?: boolean;
}

/** Map the TCK's common transaction params onto core `TransactionOptions`. */
export function transactionOptions(
    params: CommonTransactionParams | undefined,
): TransactionOptions {
    if (params == null) return {};
    // Core picks the transaction ID itself (operator + now).
    if (params.transactionId) {
        notSupported("a custom transactionId");
    }

    return {
        maxTransactionFee: params.maxTransactionFee
            ? Hbar.fromTinybars(params.maxTransactionFee)
            : undefined,
        transactionValidDuration: params.validTransactionDuration || undefined,
        transactionMemo: params.memo || undefined,
        regenerateTransactionId: params.regenerateTransactionId || undefined,
        highVolume: params.highVolume,
        additionalSigners: params.signers?.length
            ? params.signers.map(
                  (signer) => getKeyFromString(signer) as PrivateKey,
              )
            : undefined,
    };
}
