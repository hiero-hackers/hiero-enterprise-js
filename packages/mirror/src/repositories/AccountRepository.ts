import type {
    MirrorAccountInfo,
    Balance,
    TokenBalance,
    Page,
    AccountQuery,
    AccountTokensQuery,
    StakingReward,
    StakingRewardsQuery,
    AccountListQuery,
    BalancesQuery,
    AirdropsQuery,
    AllowancesQuery,
    NftAllowancesQuery,
    HooksQuery,
    HookStorageQuery,
    AccountBalanceSnapshot,
    Airdrop,
    CryptoAllowance,
    TokenAllowance,
    NftAllowance,
    Hook,
    HookStorageSlot,
} from "../types/index.js";
import type { MirrorNodeClient } from "../client/MirrorNodeClient.js";
import { MirrorError, MirrorErrorCodes } from "../errors/MirrorError.js";

/**
 * Repository for querying account data from the mirror node.
 */
export class AccountRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Find an account by any of the three forms the mirror node's
     * `/accounts/{idOrAliasOrEvmAddress}` endpoint accepts — an account ID
     * (`0.0.x`), an RFC4648 base32 alias, or a `0x`-prefixed EVM address.
     *
     * This is the permissive resolver: it does not classify or validate the
     * input, so use it when you already know the value is well-formed (or want
     * the mirror node to be the authority). For an early, typed error on
     * malformed input, use the form-specific {@link findByAccountId} /
     * {@link findByAlias} / {@link findByEvmAddress} wrappers.
     *
     * @example
     * repo.findAccount("0.0.98");
     * repo.findAccount("0x1234…abcd");
     * repo.findAccount("HIQQEXWK…"); // base32 alias
     */
    findAccount(
        idOrAliasOrEvmAddress: string,
        options?: AccountQuery,
    ): Promise<MirrorAccountInfo> {
        return this.mirrorNodeClient.queryAccount(
            idOrAliasOrEvmAddress,
            options,
        );
    }

    /**
     * Find account information by account ID (`0.0.x`). Pass `{ timestamp }` to
     * read the account's state — including its balance — as of a point in time.
     *
     * A thin, intent-revealing wrapper over {@link findAccount}; it does not
     * reject non-ID input (the endpoint accepts aliases and EVM addresses at
     * the same path), so a caller can still pass either — prefer
     * {@link findByAlias} / {@link findByEvmAddress} when you want that checked.
     *
     * @example
     * // Balance snapshot at a past moment (balance-over-time series):
     * repo.findByAccountId("0.0.98", { timestamp: "1700000000.000000000" });
     */
    findByAccountId(
        accountId: string,
        options?: AccountQuery,
    ): Promise<MirrorAccountInfo> {
        return this.findAccount(accountId, options);
    }

    /**
     * Find account information by its RFC4648 **base32 alias** (no padding) —
     * the alias the mirror node reports as `account.alias`. Rejects input that
     * isn't base32 (e.g. an account ID or EVM address); use
     * {@link findByAccountId} / {@link findByEvmAddress} for those.
     *
     * @param alias - A base32 account alias (RFC4648, no padding; charset `A–Z`/`2–7`, case-insensitive)
     */
    findByAlias(
        alias: string,
        options?: AccountQuery,
    ): Promise<MirrorAccountInfo> {
        // RFC4648 base32 (no padding). This naturally excludes account IDs
        // ('.', '0'/'1') and EVM addresses ('0x'), so it doubles as a form check.
        const isBase32 = /^[A-Za-z2-7]+$/.test(alias);
        if (!isBase32) {
            // Reject rather than throw so callers see a consistent
            // promise-based failure mode from every repository method.
            return Promise.reject(
                new MirrorError(
                    `Invalid account alias: expected an RFC4648 base32 alias (no padding), got "${alias}". ` +
                        `For an EVM address use findByEvmAddress; for an account ID use findByAccountId.`,
                    { code: MirrorErrorCodes.ConfigInvalid },
                ),
            );
        }
        return this.findAccount(alias, options);
    }

    /**
     * Find account information by its `0x`-prefixed 20-byte **EVM address**.
     * Rejects anything that isn't a valid EVM address; use {@link findByAlias}
     * for a base32 alias or {@link findByAccountId} for an account ID.
     *
     * @param address - An EVM address (e.g. `0x1234…abcd`)
     */
    findByEvmAddress(
        address: string,
        options?: AccountQuery,
    ): Promise<MirrorAccountInfo> {
        const isValidEvmAddress =
            address.startsWith("0x") &&
            address.length === 42 &&
            /^[0-9a-fA-F]+$/.test(address.slice(2));

        if (!isValidEvmAddress) {
            return Promise.reject(
                new MirrorError(
                    `Invalid EVM address: expected a 0x-prefixed 20-byte hex address, got "${address}".`,
                    { code: MirrorErrorCodes.ConfigInvalid },
                ),
            );
        }
        return this.findAccount(address, options);
    }

    /**
     * Get the balance of an account, optionally as of a point in time via
     * `{ timestamp }`.
     */
    getBalance(accountId: string, options?: AccountQuery): Promise<Balance> {
        return this.mirrorNodeClient.queryAccountBalance(accountId, options);
    }

    /**
     * List the token balances held by an account — amounts per token,
     * unlike `TokenRepository.findByAccountId` which returns token metadata.
     */
    findTokens(
        accountId: string,
        options?: AccountTokensQuery,
    ): Promise<Page<TokenBalance>> {
        return this.mirrorNodeClient.queryAccountTokens(accountId, options);
    }

    /**
     * The account's staking-reward payment history.
     */
    findRewards(
        accountId: string,
        options?: StakingRewardsQuery,
    ): Promise<Page<StakingReward>> {
        return this.mirrorNodeClient.queryStakingRewards(accountId, options);
    }

    /**
     * List accounts, optionally filtered by HBAR balance threshold. Balances are in tinybars.
     *
     * @example
     * // Accounts holding at least 1,000 ℏ:
     * repo.list({ balance: { gte: 100_000_000_000 } });
     */
    list(options?: AccountListQuery): Promise<Page<MirrorAccountInfo>> {
        return this.mirrorNodeClient.queryAccounts(options);
    }

    /**
     * Network-wide balance snapshot — unlike `list`, this supports
     * historical `{ timestamp }` queries: "how many accounts held ≥ X ℏ
     * on date D".
     *
     * @example
     * repo.listBalances({
     *   balance: { gte: 100_000_000_000 },
     *   timestamp: "1652531199.999999999",
     * });
     */
    listBalances(
        options?: BalancesQuery,
    ): Promise<Page<AccountBalanceSnapshot>> {
        return this.mirrorNodeClient.queryBalances(options);
    }

    /**
     * Airdrops waiting for the account to claim them — the read-side of
     * core's `claimAirdrop`.
     */
    findPendingAirdrops(
        accountId: string,
        options?: AirdropsQuery,
    ): Promise<Page<Airdrop>> {
        return this.mirrorNodeClient.queryPendingAirdrops(accountId, options);
    }

    /**
     * Airdrops the account has sent that remain unclaimed — the read-side
     * of core's `cancelAirdrop`.
     */
    findOutstandingAirdrops(
        accountId: string,
        options?: AirdropsQuery,
    ): Promise<Page<Airdrop>> {
        return this.mirrorNodeClient.queryOutstandingAirdrops(
            accountId,
            options,
        );
    }

    /**
     * Live HBAR allowances granted by the account.
     */
    findCryptoAllowances(
        accountId: string,
        options?: AllowancesQuery,
    ): Promise<Page<CryptoAllowance>> {
        return this.mirrorNodeClient.queryCryptoAllowances(accountId, options);
    }

    /**
     * Live fungible-token allowances granted by the account.
     */
    findTokenAllowances(
        accountId: string,
        options?: AllowancesQuery,
    ): Promise<Page<TokenAllowance>> {
        return this.mirrorNodeClient.queryTokenAllowances(accountId, options);
    }

    /**
     * Live approved-for-all NFT allowances involving the account.
     */
    findNftAllowances(
        accountId: string,
        options?: NftAllowancesQuery,
    ): Promise<Page<NftAllowance>> {
        return this.mirrorNodeClient.queryNftAllowances(accountId, options);
    }

    /**
     * List the hooks attached to the account.
     */
    findHooks(accountId: string, options?: HooksQuery): Promise<Page<Hook>> {
        return this.mirrorNodeClient.queryHooks(accountId, options);
    }

    /**
     * List a hook's storage slots.
     */
    findHookStorage(
        accountId: string,
        hookId: number,
        options?: HookStorageQuery,
    ): Promise<Page<HookStorageSlot>> {
        return this.mirrorNodeClient.queryHookStorage(
            accountId,
            hookId,
            options,
        );
    }
}
