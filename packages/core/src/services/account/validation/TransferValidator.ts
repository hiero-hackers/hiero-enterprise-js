import { Hbar, Status } from "@hiero-ledger/sdk";
import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { validationError } from "../../../errors/index.js";
import type {
    HbarTransferLeg,
    NftTransferLeg,
    TokenTransferLeg,
    TransferOptions,
} from "../operations/TransferOperation.js";

const CONTEXT = "TransferValidator";

/**
 * Validates `TransferOptions` before building the SDK transaction.
 *
 * Checks that there is at least one leg, that IDs are set, that amounts are
 * whole numbers of the smallest unit, and that the HBAR legs and each
 * token's legs sum to zero (the network's `INVALID_ACCOUNT_AMOUNTS` and
 * `TRANSFERS_NOT_ZERO_SUM_FOR_TOKEN`).
 */
export class TransferValidator {
    /**
     * Validate transfer options before any SDK construction.
     *
     * @param options - The caller-provided transfer options
     * @throws {HieroError} If validation fails
     */
    validate(options: TransferOptions): void {
        const hbarTransfers = options.hbarTransfers ?? [];
        const tokenTransfers = options.tokenTransfers ?? [];
        const nftTransfers = options.nftTransfers ?? [];

        if (
            hbarTransfers.length === 0 &&
            tokenTransfers.length === 0 &&
            nftTransfers.length === 0
        ) {
            throw validationError(
                CONTEXT,
                "At least one transfer must be provided (hbarTransfers, tokenTransfers, or nftTransfers).",
            );
        }

        this.validateHbarTransfers(hbarTransfers);
        this.validateTokenTransfers(tokenTransfers);
        this.validateNftTransfers(nftTransfers);
    }

    private validateHbarTransfers(legs: HbarTransferLeg[]): void {
        let sum = 0n;
        for (const leg of legs) {
            this.requireId(leg.accountId, "hbarTransfers[].accountId");
            sum += this.toTinybars(leg.amount);
        }

        if (sum !== 0n) {
            throw validationError(
                CONTEXT,
                "hbarTransfers must sum to zero.",
                Status.InvalidAccountAmounts,
            );
        }
    }

    private validateTokenTransfers(legs: TokenTransferLeg[]): void {
        const sums = new Map<string, bigint>();
        for (const leg of legs) {
            this.requireId(leg.tokenId, "tokenTransfers[].tokenId");
            this.requireId(leg.accountId, "tokenTransfers[].accountId");
            this.validateTokenAmount(leg.amount, leg.expectedDecimals);
            const tokenId = leg.tokenId.toString();
            sums.set(tokenId, (sums.get(tokenId) ?? 0n) + BigInt(leg.amount));
        }

        for (const [tokenId, sum] of sums) {
            if (sum !== 0n) {
                throw validationError(
                    CONTEXT,
                    `tokenTransfers of token ${tokenId} must sum to zero.`,
                    Status.TransfersNotZeroSumForToken,
                );
            }
        }
    }

    private validateNftTransfers(legs: NftTransferLeg[]): void {
        for (const leg of legs) {
            this.requireId(leg.tokenId, "nftTransfers[].tokenId");
            this.validateSerial(leg.serial);
            this.requireId(
                leg.senderAccountId,
                "nftTransfers[].senderAccountId",
            );
            this.requireId(
                leg.receiverAccountId,
                "nftTransfers[].receiverAccountId",
            );

            if (
                leg.senderAccountId.toString() ===
                leg.receiverAccountId.toString()
            ) {
                throw validationError(
                    CONTEXT,
                    "nftTransfers[].senderAccountId and receiverAccountId must be different.",
                    Status.AccountRepeatedInAccountAmounts,
                );
            }
        }
    }

    private requireId(
        value: string | AccountId | TokenId | null | undefined,
        paramName: string,
    ): void {
        if (value == null || value.toString().trim() === "") {
            throw validationError(CONTEXT, `${paramName} is required.`);
        }
    }

    /** The amount in tinybars; a number is HBAR. */
    private toTinybars(amount: number | Hbar | null | undefined): bigint {
        if (amount == null) {
            throw validationError(
                CONTEXT,
                "hbarTransfers[].amount is required.",
            );
        }

        if (typeof amount === "number" && !Number.isFinite(amount)) {
            throw validationError(
                CONTEXT,
                "hbarTransfers[].amount must be a finite number.",
            );
        }

        try {
            const hbar = amount instanceof Hbar ? amount : new Hbar(amount);

            return BigInt(hbar.toTinybars().toString());
        } catch {
            throw validationError(
                CONTEXT,
                "hbarTransfers[].amount must be a whole number of tinybars.",
            );
        }
    }

    private validateTokenAmount(
        amount: number | null | undefined,
        expectedDecimals: number | undefined,
    ): void {
        if (amount == null) {
            throw validationError(
                CONTEXT,
                "tokenTransfers[].amount is required.",
            );
        }

        if (!Number.isSafeInteger(amount)) {
            throw validationError(
                CONTEXT,
                "tokenTransfers[].amount must be a safe integer.",
            );
        }

        if (
            expectedDecimals != null &&
            (!Number.isInteger(expectedDecimals) || expectedDecimals < 0)
        ) {
            throw validationError(
                CONTEXT,
                "tokenTransfers[].expectedDecimals must be a non-negative integer.",
            );
        }
    }

    private validateSerial(serial: number | null | undefined): void {
        if (serial == null) {
            throw validationError(
                CONTEXT,
                "nftTransfers[].serial is required.",
            );
        }

        if (!Number.isSafeInteger(serial) || serial <= 0) {
            throw validationError(
                CONTEXT,
                "nftTransfers[].serial must be a positive safe integer.",
            );
        }
    }
}
