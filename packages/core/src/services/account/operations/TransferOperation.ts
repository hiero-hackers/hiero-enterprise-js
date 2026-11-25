import { Hbar, NftId, TokenId, TransferTransaction } from "@hiero-ledger/sdk";
import type { AccountId } from "@hiero-ledger/sdk";
import { BaseOperation } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
} from "../../transaction/index.js";
import { TransferValidator } from "../validation/index.js";

/** One HBAR leg of a transfer: a balance change of one account. */
export interface HbarTransferLeg {
    /** Account whose balance changes. */
    accountId: string | AccountId;
    /**
     * Signed amount: negative to send, positive to receive. A number is
     * HBAR; pass an `Hbar` (e.g. `Hbar.fromTinybars(...)`) for exact amounts.
     */
    amount: number | Hbar;
    /**
     * Spend an allowance `accountId` granted to the payer
     * (`TransactionOptions.payer`) instead of needing its signature.
     */
    approved?: boolean;
}

/** One fungible token leg of a transfer: a balance change of one account. */
export interface TokenTransferLeg {
    /** Token type. */
    tokenId: string | TokenId;
    /** Account whose balance changes. */
    accountId: string | AccountId;
    /** Signed amount in the token's smallest unit: negative to send, positive to receive. */
    amount: number;
    /**
     * Expected decimals of the token. When set, the network rejects the
     * transfer unless the token's decimals match.
     */
    expectedDecimals?: number;
    /**
     * Spend an allowance `accountId` granted to the payer
     * (`TransactionOptions.payer`) instead of needing its signature.
     */
    approved?: boolean;
}

/** One NFT moved from a sender to a receiver. */
export interface NftTransferLeg {
    /** NFT collection token ID. */
    tokenId: string | TokenId;
    /** Serial number of the NFT. */
    serial: number;
    /** Current owner. */
    senderAccountId: string | AccountId;
    /** New owner. */
    receiverAccountId: string | AccountId;
    /**
     * Spend an allowance the sender granted to the payer
     * (`TransactionOptions.payer`) instead of needing its signature.
     */
    approved?: boolean;
}

/**
 * Options for a transfer of any number of HBAR, token and NFT legs in one
 * atomic `TransferTransaction`.
 *
 * At least one leg is required. The HBAR legs must sum to zero, and so must
 * the legs of each token. Every sending account must sign (via
 * `additionalSigners` unless it is the operator), except on `approved` legs,
 * where the payer spends its allowance.
 */
export interface TransferOptions extends TransactionOptions {
    /** HBAR legs. */
    hbarTransfers?: HbarTransferLeg[];
    /** Fungible token legs, of one or more tokens. */
    tokenTransfers?: TokenTransferLeg[];
    /** NFT transfers. */
    nftTransfers?: NftTransferLeg[];
}

/**
 * Options for scheduling a transfer — combines the transfer with the
 * schedule fields (`payerAccountId`, `adminKey`, `scheduleMemo`).
 */
export type ScheduleTransferOptions = TransferOptions & ScheduleOptions;

export class TransferOperation extends BaseOperation<TransferOptions> {
    protected readonly type = "CryptoTransfer";
    protected readonly serviceName = "AccountService";
    protected readonly methodName = "transfer";
    protected readonly validator = new TransferValidator();

    /** Submit a `TransferTransaction`. */
    async execute(options: TransferOptions) {
        return await this.run(options);
    }

    /** Schedule a `TransferTransaction`. */
    async schedule(options: ScheduleTransferOptions) {
        const { payerAccountId, adminKey, scheduleMemo, ...transferOptions } =
            options;
        return await this.scheduleRun(transferOptions, {
            payerAccountId,
            adminKey,
            scheduleMemo,
        });
    }

    protected build(options: TransferOptions): TransferTransaction {
        const tx = new TransferTransaction();

        for (const leg of options.hbarTransfers ?? []) {
            const amount =
                leg.amount instanceof Hbar ? leg.amount : new Hbar(leg.amount);

            if (leg.approved) {
                tx.addApprovedHbarTransfer(leg.accountId, amount);
            } else {
                tx.addHbarTransfer(leg.accountId, amount);
            }
        }

        for (const leg of options.tokenTransfers ?? []) {
            // What the public add*TokenTransfer* methods call; the SDK has
            // none for an approved leg with decimals.
            tx._addTokenTransfer(
                leg.tokenId,
                leg.accountId,
                leg.amount,
                leg.approved === true,
                leg.expectedDecimals ?? null,
            );
        }

        for (const leg of options.nftTransfers ?? []) {
            const tokenId =
                typeof leg.tokenId === "string"
                    ? TokenId.fromString(leg.tokenId)
                    : leg.tokenId;
            const nftId = new NftId(tokenId, leg.serial);

            if (leg.approved) {
                tx.addApprovedNftTransfer(
                    nftId,
                    leg.senderAccountId,
                    leg.receiverAccountId,
                );
            } else {
                tx.addNftTransfer(
                    nftId,
                    leg.senderAccountId,
                    leg.receiverAccountId,
                );
            }
        }

        return tx;
    }
}
