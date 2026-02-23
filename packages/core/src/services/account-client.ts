import {
    AccountCreateTransaction,
    AccountDeleteTransaction,
    AccountBalanceQuery,
    Hbar,
    PrivateKey,
} from "@hashgraph/sdk";
import type { Account, Balance } from "../data/index.js";
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
            const newKey = PrivateKey.generateECDSA();

            const tx = new AccountCreateTransaction()
                .setKeyWithoutAlias(newKey.publicKey)
                .setInitialBalance(new Hbar(options.initialBalance ?? 0));

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
                evmAddress: newKey.publicKey.toEvmAddress(),
            };

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
