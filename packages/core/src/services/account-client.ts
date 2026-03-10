import {
    AccountCreateTransaction,
    AccountDeleteTransaction,
    AccountBalanceQuery,
    TransferTransaction,
    AccountId,
    PublicKey,
    Hbar,
    PrivateKey,
} from "@hashgraph/sdk";
import { AccountType } from "../types/index.js";
import type { Account, Balance } from "../types/index.js";
import type { HieroContext } from "../context/index.js";
import type { TransactionEvent } from "../listeners/index.js";
import { normalizeError } from "../errors/index.js";

/**
 * Options for creating a new account.
 */
export interface CreateAccountOptions {
    /** Initial balance in HBAR (default: 0) */
    initialBalance?: number;
    /** Maximum automatic token associations (default: 0) */
    maxAutomaticTokenAssociations?: number;
    /** Account memo */
    memo?: string;
    /** The type of account (and underlying key) to generate. Defaults to EVM (ECDSA). */
    accountType?: AccountType;
}

/**
 * Service for managing accounts on the Hiero network.
 */
export class AccountClient {
    private readonly context: HieroContext;

    constructor(context: HieroContext) {
        this.context = context;
    }

    /**
     * Create a new account on the network.
     *
     * @param options - Optional account creation parameters
     * @returns The newly created account
     */
    async createAccount(options: CreateAccountOptions = {}): Promise<Account> {
        const event: TransactionEvent = {
            type: "AccountCreate",
            serviceName: "AccountClient",
            methodName: "createAccount",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const type = options.accountType ?? AccountType.EVM;
            const newKey =
                type === AccountType.EVM
                    ? PrivateKey.generateECDSA()
                    : PrivateKey.generateED25519();

            const tx = new AccountCreateTransaction()
                .setKeyWithoutAlias(newKey.publicKey)
                .setInitialBalance(new Hbar(options.initialBalance ?? 0));

            if (type === AccountType.EVM) {
                tx.setAlias(newKey.publicKey.toEvmAddress());
            }

            if (options.maxAutomaticTokenAssociations !== undefined) {
                tx.setMaxAutomaticTokenAssociations(
                    options.maxAutomaticTokenAssociations,
                );
            }
            if (options.memo) {
                tx.setAccountMemo(options.memo);
            }

            const response = await tx.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);

            const result: Account = {
                accountId: receipt.accountId!.toString(),
                publicKey: newKey.publicKey.toString(),
                privateKey: newKey.toString(),
            };

            if (type === AccountType.EVM) {
                result.evmAddress = newKey.publicKey.toEvmAddress();
            }

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });

            return result;
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "AccountClient.createAccount");
        }
    }

    /**
     * Creates a new account using a provided public key string.
     * Supports both Ed25519 (Native) and ECDSA (EVM-compatible) keys.
     *
     * @param publicKeyStr - The public key string (raw or DER formatted)
     * @param type - The account type (EVM vs NATIVE)
     * @param initialBalance - The amount of HBAR to fund the account initially
     * @param memo - Optional memo
     */
    async createAccountWithPublicKey(
        publicKeyStr: string,
        type: AccountType,
        initialBalance: number = 0,
        memo?: string,
    ): Promise<Account> {
        const event: TransactionEvent = {
            type: "AccountCreate",
            serviceName: "AccountClient",
            methodName: "createAccountWithPublicKey",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const publicKey =
                type === AccountType.EVM
                    ? PublicKey.fromStringECDSA(publicKeyStr)
                    : PublicKey.fromStringED25519(publicKeyStr);

            const tx = new AccountCreateTransaction()
                .setKeyWithoutAlias(publicKey)
                .setInitialBalance(new Hbar(initialBalance));

            if (type === AccountType.EVM) {
                tx.setAlias(publicKey.toEvmAddress());
            }
            if (memo) {
                tx.setAccountMemo(memo);
            }

            const response = await tx.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);

            const result: Account = {
                accountId: receipt.accountId!.toString(),
                publicKey: publicKey.toString(),
            };

            if (type === AccountType.EVM) {
                result.evmAddress = publicKey.toEvmAddress();
            }

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });

            return result;
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(
                error,
                "AccountClient.createAccountWithPublicKey",
            );
        }
    }

    /**
     * Auto-creates a "Hollow Account" by transferring HBAR to an EVM address.
     * Useful for onboarding MetaMask users who don't have a Hedera ID yet.
     *
     * @param evmAddress - The EVM address (e.g., 0x...)
     * @param amount - The amount of HBAR to transfer
     */
    async autoCreateEvmAccount(
        evmAddress: string,
        amount: number,
    ): Promise<void> {
        const event: TransactionEvent = {
            type: "TokenTransfer", // Reusing TokenTransfer event type for HBAR transfer
            serviceName: "AccountClient",
            methodName: "autoCreateEvmAccount",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const transferTx = new TransferTransaction()
                .addHbarTransfer(
                    this.context.operatorAccountId,
                    new Hbar(amount).negated(),
                )
                .addHbarTransfer(
                    AccountId.fromEvmAddress(0, 0, evmAddress),
                    new Hbar(amount),
                );

            const response = await transferTx.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "AccountClient.autoCreateEvmAccount");
        }
    }

    /**
     * Delete an account, transferring remaining balance to another account.
     *
     * @param accountId - Account to delete
     * @param transferAccountId - Account to receive remaining balance (defaults to operator)
     * @param accountKey - Private key of the account being deleted
     */
    async deleteAccount(
        accountId: string,
        accountKey: string,
        transferAccountId?: string,
    ): Promise<void> {
        const event: TransactionEvent = {
            type: "AccountDelete",
            serviceName: "AccountClient",
            methodName: "deleteAccount",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const key = PrivateKey.fromString(accountKey);
            const transferTo =
                transferAccountId ?? this.context.operatorAccountId.toString();

            const tx = new AccountDeleteTransaction()
                .setAccountId(accountId)
                .setTransferAccountId(transferTo)
                .freezeWith(this.context.client);

            const response = await (
                await tx.sign(key)
            ).execute(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: "SUCCESS",
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "AccountClient.deleteAccount");
        }
    }

    /**
     * Get the balance of an account.
     *
     * @param accountId - Account to query
     * @returns The account balance
     */
    async getAccountBalance(accountId: string): Promise<Balance> {
        try {
            const balance = await new AccountBalanceQuery()
                .setAccountId(accountId)
                .execute(this.context.client);

            const tokens = balance.tokens
                ? [...balance.tokens._map.entries()].map(
                      ([tokenId, amount]) => ({
                          tokenId: tokenId.toString(),
                          balance: amount.toNumber(),
                          decimals: 0, // SDK balance query doesn't return decimals
                      }),
                  )
                : [];

            return {
                accountId,
                hbars: balance.hbars.toTinybars().toNumber(),
                tokens,
            };
        } catch (error) {
            throw normalizeError(error, "AccountClient.getAccountBalance");
        }
    }

    /**
     * Get the balance of the operator account.
     *
     * @returns The operator account balance
     */
    async getOperatorAccountBalance(): Promise<Balance> {
        return this.getAccountBalance(
            this.context.operatorAccountId.toString(),
        );
    }
}
