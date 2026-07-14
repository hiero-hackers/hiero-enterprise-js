import type {
    MirrorAccountInfo,
    Balance,
    Nft,
    MirrorTokenInfo,
    MirrorTopicMessage,
    TransactionInfo,
    ExchangeRates,
    NetworkStake,
    NetworkNode,
    NetworkSupplies,
    Page,
    TransactionQuery,
    AccountQuery,
    NetworkSupplyQuery,
    AccountListQuery,
    TokenBalancesQuery,
    BalancesQuery,
    AirdropsQuery,
    AllowancesQuery,
    NftAllowancesQuery,
    SchedulesQuery,
    NftTransactionsQuery,
    NetworkFeesQuery,
    TokenQuery,
    TokensQuery,
    AccountTokensQuery,
    AccountNftsQuery,
    TokenNftsQuery,
    ExchangeRateQuery,
    NetworkNodesQuery,
    StakingRewardsQuery,
    FeeEstimateQuery,
    TransactionLookupQuery,
    TopicMessagesQuery,
    BlocksQuery,
    HooksQuery,
    HookStorageQuery,
    RegisteredNodesQuery,
    ContractsQuery,
    ContractQuery,
    ContractResultsQuery,
    ContractResultQuery,
    ContractStateQuery,
    ContractLogsQuery,
    ContractActionsQuery,
    OpcodesQuery,
    TokenHolder,
    TokenBalance,
    AccountBalanceSnapshot,
    Airdrop,
    CryptoAllowance,
    TokenAllowance,
    NftAllowance,
    MirrorSchedule,
    MirrorTopicInfo,
    NetworkFees,
    NftTransaction,
    Block,
    Hook,
    HookStorageSlot,
    RegisteredNode,
    MirrorContract,
    MirrorContractDetail,
    ContractResult,
    ContractResultDetails,
    ContractLog,
    ContractStateEntry,
    ContractAction,
    OpcodeTrace,
    ContractCallRequest,
    ContractCallResult,
    StakingReward,
    FeeEstimate,
    MirrorPageResponse,
    MirrorAccountResponse,
    MirrorNft,
    MirrorTokenResponse,
    MirrorTopicMessageRaw,
    MirrorTransactionListResponse,
    MirrorExchangeRatesResponse,
    MirrorNetworkSupplyResponse,
    MirrorNetworkStakeResponse,
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
import { MirrorError, MirrorErrorCodes } from "../errors/MirrorError.js";
import {
    convertPage,
    convertAccountInfo,
    convertBalance,
    convertNft,
    convertTokenInfo,
    convertTopicMessage,
    convertTransactionInfo,
    convertExchangeRate,
    convertNetworkStake,
    convertTokenHolder,
    convertAccountTokenBalance,
    convertNetworkNode,
    convertAccountBalanceSnapshot,
    convertAirdrop,
    convertCryptoAllowance,
    convertTokenAllowance,
    convertNftAllowance,
    convertSchedule,
    convertTopicInfo,
    convertNetworkFees,
    convertNftTransaction,
    convertBlock,
    convertHook,
    convertHookStorageSlot,
    convertRegisteredNode,
    convertContract,
    convertContractDetail,
    convertContractResult,
    convertContractResultDetails,
    convertContractLog,
    convertContractState,
    convertContractAction,
    convertOpcodeTrace,
    convertStakingReward,
    convertFeeEstimate,
} from "../utils/MirrorNodeConverters.js";
import {
    assertPageResponse,
    assertAccountResponse,
    assertNftResponse,
    assertTokenResponse,
    assertTopicMessageResponse,
    assertTransactionListResponse,
    assertTransactionResponse,
    assertExchangeRatesResponse,
    assertNetworkSupplyResponse,
    assertNetworkStakeResponse,
    assertScheduleResponse,
    assertTopicResponse,
    assertNetworkFeesResponse,
    assertBlockResponse,
    assertContractResponse,
    assertContractResultResponse,
    assertOpcodesResponse,
    assertContractCallResponse,
    assertFeeEstimateResponse,
} from "../utils/MirrorNodeValidators.js";
import { RequestGate } from "./RequestGate.js";
import { appendQuery, segment } from "../utils/MirrorNodeQuery.js";

/** Default per-request timeout, in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 10_000;
/** Default number of retries for 429/5xx/timeout responses. */
export const DEFAULT_MAX_RETRIES = 3;
/** Base delay for exponential backoff between retries, in milliseconds. */
const BACKOFF_BASE_MS = 100;
/** Upper bound on a single backoff delay, in milliseconds. */
const BACKOFF_CAP_MS = 5_000;
/** Random jitter added to each backoff delay, in milliseconds. */
const BACKOFF_JITTER_MS = 100;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract the mirror node's diagnostic message from an error response
 * body (`{ _status: { messages: [{ message, detail }] } }`), so thrown
 * errors say *why* the request failed, not just the HTTP status.
 * Returns an empty string when the body isn't in that shape.
 */
async function readErrorDetail(response: Response): Promise<string> {
    try {
        const body = (await response.json()) as {
            _status?: {
                messages?: Array<{ message?: string; detail?: string | null }>;
            };
        };
        const first = body?._status?.messages?.[0];
        if (!first?.message) return "";
        return first.detail
            ? `${first.message} (${first.detail})`
            : first.message;
    } catch {
        return "";
    }
}

/**
 * Parse the HTTP `Retry-After` header. Supports both the delta-seconds
 * format (`120`) and HTTP-date format (`Wed, 21 Oct 2026 07:28:00 GMT`).
 * Returns the delay in milliseconds, or `null` if the header is absent
 * or unparseable.
 */
function parseRetryAfter(header: string | null): number | null {
    if (!header) return null;
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.floor(seconds * 1000);
    }
    const dateMs = Date.parse(header);
    if (Number.isFinite(dateMs)) {
        return Math.max(0, dateMs - Date.now());
    }
    return null;
}

/**
 * Wire params shared by the per-contract and network-wide result listings
 * — one source of truth so the two endpoints can't drift apart.
 */
function contractResultsQueryParams(options?: ContractResultsQuery) {
    return {
        "block.hash": options?.blockHash,
        "block.number": options?.blockNumber,
        from: options?.from,
        internal: options?.internal,
        timestamp: options?.timestamp,
        "transaction.index": options?.transactionIndex,
        limit: options?.limit,
        order: options?.order,
    };
}

/**
 * Wire params shared by the per-contract and network-wide log listings.
 */
function contractLogsQueryParams(options?: ContractLogsQuery) {
    return {
        index: options?.index,
        timestamp: options?.timestamp,
        topic0: options?.topic0,
        topic1: options?.topic1,
        topic2: options?.topic2,
        topic3: options?.topic3,
        limit: options?.limit,
        order: options?.order,
    };
}

/** Tuning options for {@link MirrorNodeClient}. */
export interface MirrorNodeClientOptions {
    /** Per-request timeout in milliseconds (default: 10000). */
    timeoutMs?: number;
    /** Max retries for 429/5xx/timeout responses (default: 3). */
    maxRetries?: number;
    /**
     * Maximum number of requests allowed in flight at once. Additional
     * requests queue and start as slots free up. This is *pro-active*
     * back-pressure: it bounds parallelism before the mirror node ever
     * returns a 429, instead of relying solely on reactive retries.
     *
     * Default: 25. Set to `Infinity` to disable the concurrency cap.
     */
    maxConcurrent?: number;
    /**
     * Ceiling on the sustained request rate, in requests per second.
     * Request starts are spaced by `1000 / maxRequestsPerSecond` ms so the
     * client stays under the mirror node's transactions-per-second limit
     * (e.g. `50` keeps it under 50 TPS) even under heavy fan-out.
     *
     * Default: unlimited (no spacing). Combine with {@link maxConcurrent}
     * for safe large-volume fetching.
     */
    maxRequestsPerSecond?: number;
}

/**
 * HTTP client for querying the Hiero Mirror Node REST API.
 *
 * Includes a built-in, configurable concurrency + rate limiter so large
 * data pulls stay under the mirror node's limits pro-actively rather than
 * hammering it and backing off after each 429.
 *
 * ## Why this is one large, flat file (a deliberate choice)
 *
 * Every endpoint is a method here, grouped into `// ───`-bannered sections
 * by domain. The file is long but not complex: each method is the same
 * three-line shape — build the path with {@link appendQuery} / a template,
 * then `getPage` (lists) or `request` + assert + convert (single objects).
 *
 * It stays a single class on purpose. The methods share one transport
 * (`request`), one pagination wrapper (`getPage`), and one `RequestGate`;
 * splitting them across files would need mixins or free functions that
 * thread the gate around, trading a flat method registry (trivial
 * jump-to-symbol) for indirection with no consumer benefit. The
 * *consumer-facing* per-domain grouping already exists one layer up, in
 * `repositories/` — that is the surface apps should use. Add a new endpoint
 * as a method in the matching section; see CONTRIBUTING's "Adding a mirror
 * endpoint" checklist.
 */
export class MirrorNodeClient {
    private readonly baseUrl: string;
    private readonly timeoutMs: number;
    private readonly maxRetries: number;

    /** Pro-active concurrency + rate limiter shared by every request. */
    private readonly gate: RequestGate;

    constructor(baseUrl: string, options?: MirrorNodeClientOptions) {
        // Remove trailing slashes
        let url = baseUrl;
        while (url.endsWith("/")) {
            url = url.slice(0, -1);
        }
        this.baseUrl = url;
        this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
        this.gate = new RequestGate({
            maxConcurrent: options?.maxConcurrent,
            maxRequestsPerSecond: options?.maxRequestsPerSecond,
        });
    }

    /**
     * Run a mirror node request through the concurrency/rate gate, including
     * its retry loop. One logical request holds exactly one slot; retries do
     * not re-acquire, so a burst of retries can never deadlock the gate.
     */
    private request<T>(path: string, body?: unknown): Promise<T> {
        return this.gate.run(() => this.fetchWithRetry<T>(path, body));
    }

    /**
     * Raw GET escape hatch: fetch any mirror node path + query (e.g.
     * `/api/v1/topics/0.0.1/messages?order=asc&limit=100`) and return
     * the parsed JSON body, untyped.
     *
     * The request goes through the same gate (concurrency + rate
     * limit), timeout, retry, and error mapping as every typed query —
     * use this for endpoints or parameters the typed surface does not
     * cover yet, or to drive tooling that composes its own paths (it
     * also makes this client a drop-in transport for such tools). The
     * caller is responsible for percent-encoding anything interpolated
     * into `pathAndQuery`.
     */
    get<T = unknown>(pathAndQuery: string): Promise<T> {
        return this.request<T>(pathAndQuery);
    }

    // ─── HTTP Helper ─────────────────────────────────────────────

    /**
     * Issue a request against the mirror node with timeout + retry
     * semantics — a GET, or a JSON POST when `body` is provided.
     *
     * - Each attempt is bounded by `timeoutMs` via AbortController.
     * - HTTP 429 and 5xx responses are retried up to `maxRetries` times,
     *   honouring the `Retry-After` header when present. The only POST
     *   endpoint (`/contracts/call`) is a transient simulation, so it is
     *   as safe to retry as a GET.
     * - Timeouts (AbortError / TimeoutError) are retried with exponential
     *   backoff, then surfaced as a TimedOut MirrorError. Other network
     *   errors (DNS, ECONNREFUSED, …) are surfaced immediately — they
     *   almost always indicate a misconfigured base URL, not a transient
     *   blip, so retrying only delays a certain failure.
     */
    private async fetchWithRetry<T>(
        path: string,
        body?: unknown,
        attempt = 0,
    ): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        let response: Response;
        try {
            response = await fetch(url, {
                signal: controller.signal,
                ...(body !== undefined && {
                    method: "POST",
                    ...(body instanceof Uint8Array
                        ? {
                              headers: {
                                  "content-type": "application/protobuf",
                              },
                              body,
                          }
                        : {
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify(body),
                          }),
                }),
            });
        } catch (err) {
            clearTimeout(timer);
            const isAbort =
                err instanceof Error &&
                (err.name === "AbortError" || err.name === "TimeoutError");

            // Only retry timeouts here. Generic network errors (DNS, ECONNREFUSED)
            // are surfaced immediately — they almost always indicate a misconfigured
            // base URL rather than a transient blip.
            if (isAbort && attempt < this.maxRetries) {
                await sleep(this.backoffMs(attempt));
                return this.fetchWithRetry<T>(path, body, attempt + 1);
            }

            throw new MirrorError(
                isAbort
                    ? `Mirror node request timed out after ${this.timeoutMs}ms: ${url}`
                    : `Mirror node request failed: ${url}`,
                {
                    code: isAbort
                        ? MirrorErrorCodes.TimedOut
                        : MirrorErrorCodes.MirrorNodeError,
                    context: path,
                    cause: err instanceof Error ? err : undefined,
                },
            );
        }
        if (
            (response.status === 429 || response.status >= 500) &&
            attempt < this.maxRetries
        ) {
            clearTimeout(timer);
            const retryAfter = parseRetryAfter(
                response.headers.get("retry-after"),
            );
            await sleep(retryAfter ?? this.backoffMs(attempt));
            return this.fetchWithRetry<T>(path, body, attempt + 1);
        }

        // The timer stays armed across the body read: a stalled/slow
        // response body would otherwise hold a gate slot open forever
        // (the fetch timeout only covers connection + headers). An abort
        // here surfaces as a TimedOut MirrorError, same as a header timeout.
        try {
            if (!response.ok) {
                const detail = await readErrorDetail(response);
                throw new MirrorError(
                    `Mirror node returned ${response.status}: ${response.statusText}` +
                        (detail ? ` — ${detail}` : ""),
                    {
                        code: MirrorErrorCodes.MirrorNodeHttpError,
                        context: path,
                    },
                );
            }
            return (await response.json()) as T;
        } catch (err) {
            if (
                err instanceof Error &&
                (err.name === "AbortError" || err.name === "TimeoutError")
            ) {
                throw new MirrorError(
                    `Mirror node response body timed out after ${this.timeoutMs}ms: ${url}`,
                    { code: MirrorErrorCodes.TimedOut, context: path },
                );
            }
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }

    private backoffMs(attempt: number): number {
        // Exponential backoff with jitter: 100, 200, 400, 800, … ms, capped at 5s.
        const base = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
        return base + Math.floor(Math.random() * BACKOFF_JITTER_MS);
    }

    // ─── Accounts ────────────────────────────────────────────────

    /**
     * Look up a single account. Pass `{ timestamp }` to read the account's
     * state — including its balance — as of a point in time (the basis for
     * balance-over-time series).
     */
    async queryAccount(
        accountId: string,
        options?: AccountQuery,
    ): Promise<MirrorAccountInfo> {
        const path = appendQuery(`/api/v1/accounts/${segment(accountId)}`, {
            timestamp: options?.timestamp,
            transactions: options?.includeTransactions,
        });
        const raw = await this.request<MirrorAccountResponse>(path);
        assertAccountResponse(raw, path);
        return convertAccountInfo(raw);
    }

    /**
     * Fetch an account's HBAR and token balances, optionally as of a point
     * in time via `{ timestamp }`.
     */
    async queryAccountBalance(
        accountId: string,
        options?: AccountQuery,
    ): Promise<Balance> {
        const path = appendQuery(`/api/v1/accounts/${segment(accountId)}`, {
            timestamp: options?.timestamp,
            transactions: options?.includeTransactions,
        });
        const raw = await this.request<MirrorAccountResponse>(path);
        assertAccountResponse(raw, path);
        return convertBalance(accountId, raw);
    }

    /**
     * List the token balances held by an account
     * (`/api/v1/accounts/{id}/tokens`) — amounts per token, unlike
     * `queryTokensByAccountId` which returns token metadata.
     */
    queryAccountTokens(
        accountId: string,
        options?: AccountTokensQuery,
    ): Promise<Page<TokenBalance>> {
        return this.getPage(
            appendQuery(`/api/v1/accounts/${segment(accountId)}/tokens`, {
                "token.id": options?.tokenId,
                limit: options?.limit,
                order: options?.order,
            }),
            convertAccountTokenBalance,
        );
    }

    /**
     * List accounts, optionally filtered by HBAR balance threshold — balances are in tinybars.
     */
    queryAccounts(
        options?: AccountListQuery,
    ): Promise<Page<MirrorAccountInfo>> {
        return this.getPage(
            appendQuery("/api/v1/accounts", {
                "account.balance": options?.balance,
                "account.id": options?.accountId,
                "account.publickey": options?.publicKey,
                balance: options?.includeBalance,
                limit: options?.limit,
                order: options?.order,
            }),
            convertAccountInfo,
        );
    }

    // ─── NFTs ────────────────────────────────────────────────────

    queryNftsByAccount(
        accountId: string,
        options?: AccountNftsQuery,
    ): Promise<Page<Nft>> {
        return this.getPage(
            appendQuery(`/api/v1/accounts/${segment(accountId)}/nfts`, {
                "token.id": options?.tokenId,
                serialnumber: options?.serialNumber,
                "spender.id": options?.spenderId,
                limit: options?.limit,
                order: options?.order,
            }),
            convertNft,
        );
    }

    queryNftsByTokenId(
        tokenId: string,
        options?: TokenNftsQuery,
    ): Promise<Page<Nft>> {
        return this.getPage(
            appendQuery(`/api/v1/tokens/${segment(tokenId)}/nfts`, {
                "account.id": options?.accountId,
                serialnumber: options?.serialNumber,
                limit: options?.limit,
                order: options?.order,
            }),
            convertNft,
        );
    }

    async queryNftsByTokenIdAndSerial(
        tokenId: string,
        serialNumber: number,
    ): Promise<Nft> {
        const raw = await this.request<MirrorNft>(
            `/api/v1/tokens/${segment(tokenId)}/nfts/${segment(serialNumber)}`,
        );
        assertNftResponse(
            raw,
            `/api/v1/tokens/${segment(tokenId)}/nfts/${segment(serialNumber)}`,
        );
        return convertNft(raw);
    }

    queryNftsByAccountAndTokenId(
        accountId: string,
        tokenId: string,
        options?: AccountNftsQuery,
    ): Promise<Page<Nft>> {
        return this.queryNftsByAccount(accountId, { ...options, tokenId });
    }

    // ─── Tokens ──────────────────────────────────────────────────

    /**
     * Look up one token's metadata, optionally as of a point in time via
     * `{ timestamp }` (e.g. historical total supply).
     */
    async queryTokenById(
        tokenId: string,
        options?: TokenQuery,
    ): Promise<MirrorTokenInfo> {
        const path = appendQuery(`/api/v1/tokens/${segment(tokenId)}`, {
            timestamp: options?.timestamp,
        });
        const raw = await this.request<MirrorTokenResponse>(path);
        assertTokenResponse(raw, path);
        return convertTokenInfo(raw);
    }

    /**
     * List tokens network-wide — filter by associated account, partial
     * name match, public key, ID range, or type.
     */
    queryTokens(options?: TokensQuery): Promise<Page<MirrorTokenInfo>> {
        return this.getPage(
            appendQuery("/api/v1/tokens", {
                "account.id": options?.accountId,
                name: options?.name,
                publickey: options?.publicKey,
                "token.id": options?.tokenId,
                type: options?.type,
                limit: options?.limit,
                order: options?.order,
            }),
            convertTokenInfo,
        );
    }

    queryTokensByAccountId(
        accountId: string,
        options?: TokensQuery,
    ): Promise<Page<MirrorTokenInfo>> {
        return this.queryTokens({ ...options, accountId });
    }

    /**
     * List the holders of a token, optionally filtered by balance threshold
     * (in the token's smallest unit)
     */
    queryTokenBalances(
        tokenId: string,
        options?: TokenBalancesQuery,
    ): Promise<Page<TokenHolder>> {
        return this.getPage(
            appendQuery(`/api/v1/tokens/${segment(tokenId)}/balances`, {
                "account.balance": options?.accountBalance,
                "account.id": options?.accountId,
                "account.publickey": options?.publicKey,
                timestamp: options?.timestamp,
                limit: options?.limit,
                order: options?.order,
            }),
            convertTokenHolder,
        );
    }

    // ─── Topics ──────────────────────────────────────────────────

    queryTopicMessages(
        topicId: string,
        options?: TopicMessagesQuery,
    ): Promise<Page<MirrorTopicMessage>> {
        return this.getPage(
            appendQuery(`/api/v1/topics/${segment(topicId)}/messages`, {
                sequencenumber: options?.sequenceNumber,
                timestamp: options?.timestamp,
                limit: options?.limit,
                order: options?.order,
            }),
            convertTopicMessage,
        );
    }

    async queryTopicMessageBySequence(
        topicId: string,
        sequenceNumber: number,
    ): Promise<MirrorTopicMessage> {
        const raw = await this.request<MirrorTopicMessageRaw>(
            `/api/v1/topics/${segment(topicId)}/messages/${segment(sequenceNumber)}`,
        );
        assertTopicMessageResponse(
            raw,
            `/api/v1/topics/${segment(topicId)}/messages/${segment(sequenceNumber)}`,
        );
        return convertTopicMessage(raw);
    }

    /**
     * Look up a topic message by its consensus timestamp alone — no topic
     * ID needed (`/api/v1/topics/messages/{timestamp}`).
     */
    async queryTopicMessageByTimestamp(
        timestamp: string,
    ): Promise<MirrorTopicMessage> {
        const path = `/api/v1/topics/messages/${segment(timestamp)}`;
        const raw = await this.request<MirrorTopicMessageRaw>(path);
        assertTopicMessageResponse(raw, path);
        return convertTopicMessage(raw);
    }

    // ─── Transactions ────────────────────────────────────────────

    /**
     * Query transactions with bundled filters — type, timestamp window,
     * page controls, and optionally an account. Omit `accountId` to search
     * network-wide (e.g. all `CRYPTOTRANSFER`s in a window, regardless of
     * account).
     */
    queryTransactions(
        options?: TransactionQuery,
    ): Promise<Page<TransactionInfo>> {
        return this.getPage(
            appendQuery("/api/v1/transactions", {
                "account.id": options?.accountId,
                transactiontype: options?.transactionType,
                timestamp: options?.timestamp,
                result: options?.result,
                type: options?.type,
                limit: options?.limit,
                order: options?.order,
            }),
            convertTransactionInfo,
        );
    }

    /** Query transactions involving a specific account. */
    queryTransactionsByAccount(
        accountId: string,
        options?: TransactionQuery,
    ): Promise<Page<TransactionInfo>> {
        return this.queryTransactions({ ...options, accountId });
    }

    async queryTransaction(
        transactionId: string,
        options?: TransactionLookupQuery,
    ): Promise<TransactionInfo> {
        const raw = await this.request<MirrorTransactionListResponse>(
            appendQuery(`/api/v1/transactions/${segment(transactionId)}`, {
                nonce: options?.nonce,
                scheduled: options?.scheduled,
            }),
        );
        assertTransactionListResponse(
            raw,
            `/api/v1/transactions/${segment(transactionId)}`,
        );
        if (!raw.transactions || raw.transactions.length === 0) {
            throw new MirrorError(`Transaction not found: ${transactionId}`, {
                code: MirrorErrorCodes.NotFound,
            });
        }
        assertTransactionResponse(
            raw.transactions[0],
            `/api/v1/transactions/${segment(transactionId)}`,
        );
        return convertTransactionInfo(raw.transactions[0]);
    }

    // ─── Network ─────────────────────────────────────────────────

    /**
     * The HBAR/cent exchange rate, optionally as of a point in time via
     * `{ timestamp }` (historical price series).
     */
    async queryExchangeRates(
        options?: ExchangeRateQuery,
    ): Promise<ExchangeRates> {
        const path = appendQuery("/api/v1/network/exchangerate", {
            timestamp: options?.timestamp,
        });
        const raw = await this.request<MirrorExchangeRatesResponse>(path);
        assertExchangeRatesResponse(raw, path);
        return {
            currentRate: convertExchangeRate(raw.current_rate),
            nextRate: convertExchangeRate(raw.next_rate),
            timestamp: raw.timestamp,
        };
    }

    /**
     * Fetch network supply, optionally as of a point in time via
     * `{ timestamp }` (historical supply series).
     */
    async queryNetworkSupplies(
        options?: NetworkSupplyQuery,
    ): Promise<NetworkSupplies> {
        const path = appendQuery("/api/v1/network/supply", {
            timestamp: options?.timestamp,
        });
        const raw = await this.request<MirrorNetworkSupplyResponse>(path);
        assertNetworkSupplyResponse(raw, path);
        return {
            releasedSupply: raw.released_supply,
            totalSupply: raw.total_supply,
            timestamp: raw.timestamp,
        };
    }

    async queryNetworkStake(): Promise<NetworkStake> {
        const raw = await this.request<MirrorNetworkStakeResponse>(
            "/api/v1/network/stake",
        );
        assertNetworkStakeResponse(raw, "/api/v1/network/stake");
        return convertNetworkStake(raw);
    }

    /**
     * List consensus nodes with their staking state
     * (`/api/v1/network/nodes`) — per-node stake for staking analytics.
     */
    queryNetworkNodes(options?: NetworkNodesQuery): Promise<Page<NetworkNode>> {
        return this.getPage(
            appendQuery("/api/v1/network/nodes", {
                "node.id": options?.nodeId,
                "file.id": options?.fileId,
                limit: options?.limit,
                order: options?.order,
            }),
            convertNetworkNode,
        );
    }

    /**
     * An account's staking-reward payment history
     * (`/api/v1/accounts/{id}/rewards`).
     */
    queryStakingRewards(
        accountId: string,
        options?: StakingRewardsQuery,
    ): Promise<Page<StakingReward>> {
        return this.getPage(
            appendQuery(`/api/v1/accounts/${segment(accountId)}/rewards`, {
                timestamp: options?.timestamp,
                limit: options?.limit,
                order: options?.order,
            }),
            convertStakingReward,
        );
    }

    /**
     * Estimate the fees for a HAPI transaction without submitting it
     * (`POST /api/v1/network/fees`, HIP-1313). Pass the protobuf-encoded
     * transaction bytes (e.g. from core's `transaction.toBytes()`);
     * amounts in the estimate are in tinycents.
     */
    async queryFeeEstimate(
        transaction: Uint8Array,
        options?: FeeEstimateQuery,
    ): Promise<FeeEstimate> {
        const path = appendQuery("/api/v1/network/fees", {
            mode: options?.mode,
            high_volume_throttle: options?.highVolumeThrottle,
        });
        const raw = await this.request<MirrorFeeEstimateResponse>(
            path,
            transaction,
        );
        assertFeeEstimateResponse(raw, path);
        return convertFeeEstimate(raw);
    }

    // ─── Balances snapshot ───────────────────────────────────────

    /**
     * Network-wide account balance snapshot (`/api/v1/balances`) —
     * supports historical `{ timestamp }` queries, unlike `queryAccounts`.
     * The basis for "how many accounts held ≥ X ℏ on date D".
     */
    queryBalances(
        options?: BalancesQuery,
    ): Promise<Page<AccountBalanceSnapshot>> {
        return this.getPage(
            appendQuery("/api/v1/balances", {
                "account.id": options?.accountId,
                "account.balance": options?.balance,
                "account.publickey": options?.publicKey,
                timestamp: options?.timestamp,
                limit: options?.limit,
                order: options?.order,
            }),
            convertAccountBalanceSnapshot,
        );
    }

    // ─── Airdrops (read-side of claim/cancel) ────────────────────

    /** Airdrops waiting for the account to claim them. */
    queryPendingAirdrops(
        accountId: string,
        options?: AirdropsQuery,
    ): Promise<Page<Airdrop>> {
        return this.getPage(
            appendQuery(
                `/api/v1/accounts/${segment(accountId)}/airdrops/pending`,
                {
                    "sender.id": options?.senderId,
                    serialnumber: options?.serialNumber,
                    "token.id": options?.tokenId,
                    limit: options?.limit,
                    order: options?.order,
                },
            ),
            convertAirdrop,
        );
    }

    /** Airdrops the account has sent that remain unclaimed. */
    queryOutstandingAirdrops(
        accountId: string,
        options?: AirdropsQuery,
    ): Promise<Page<Airdrop>> {
        return this.getPage(
            appendQuery(
                `/api/v1/accounts/${segment(accountId)}/airdrops/outstanding`,
                {
                    "receiver.id": options?.receiverId,
                    serialnumber: options?.serialNumber,
                    "token.id": options?.tokenId,
                    limit: options?.limit,
                    order: options?.order,
                },
            ),
            convertAirdrop,
        );
    }

    // ─── Allowances (read-side of approve/delete) ────────────────

    /** Live HBAR allowances granted by the account. */
    queryCryptoAllowances(
        accountId: string,
        options?: AllowancesQuery,
    ): Promise<Page<CryptoAllowance>> {
        return this.getPage(
            appendQuery(
                `/api/v1/accounts/${segment(accountId)}/allowances/crypto`,
                {
                    "spender.id": options?.spenderId,
                    limit: options?.limit,
                    order: options?.order,
                },
            ),
            convertCryptoAllowance,
        );
    }

    /** Live fungible-token allowances granted by the account. */
    queryTokenAllowances(
        accountId: string,
        options?: AllowancesQuery,
    ): Promise<Page<TokenAllowance>> {
        return this.getPage(
            appendQuery(
                `/api/v1/accounts/${segment(accountId)}/allowances/tokens`,
                {
                    "spender.id": options?.spenderId,
                    "token.id": options?.tokenId,
                    limit: options?.limit,
                    order: options?.order,
                },
            ),
            convertTokenAllowance,
        );
    }

    /** Live approved-for-all NFT allowances involving the account. */
    queryNftAllowances(
        accountId: string,
        options?: NftAllowancesQuery,
    ): Promise<Page<NftAllowance>> {
        return this.getPage(
            appendQuery(
                `/api/v1/accounts/${segment(accountId)}/allowances/nfts`,
                {
                    "account.id": options?.accountId,
                    "token.id": options?.tokenId,
                    owner: options?.owner,
                    limit: options?.limit,
                    order: options?.order,
                },
            ),
            convertNftAllowance,
        );
    }

    // ─── Schedules (read-side of ScheduleService) ────────────────

    /** List scheduled transactions. */
    querySchedules(options?: SchedulesQuery): Promise<Page<MirrorSchedule>> {
        return this.getPage(
            appendQuery("/api/v1/schedules", {
                "account.id": options?.accountId,
                "schedule.id": options?.scheduleId,
                limit: options?.limit,
                order: options?.order,
            }),
            convertSchedule,
        );
    }

    /** Look up one scheduled transaction's state. */
    async querySchedule(scheduleId: string): Promise<MirrorSchedule> {
        const path = `/api/v1/schedules/${segment(scheduleId)}`;
        const raw = await this.request<MirrorScheduleResponse>(path);
        assertScheduleResponse(raw, path);
        return convertSchedule(raw);
    }

    // ─── Topic info ──────────────────────────────────────────────

    /**
     * Topic metadata — the keyless counterpart of a consensus TopicInfo
     * query.
     */
    async queryTopic(topicId: string): Promise<MirrorTopicInfo> {
        const path = `/api/v1/topics/${segment(topicId)}`;
        const raw = await this.request<MirrorTopicResponse>(path);
        assertTopicResponse(raw, path);
        return convertTopicInfo(raw);
    }

    // ─── Network fees ────────────────────────────────────────────

    /** The network fee schedule, optionally as of a point in time. */
    async queryNetworkFees(options?: NetworkFeesQuery): Promise<NetworkFees> {
        const path = appendQuery("/api/v1/network/fees", {
            timestamp: options?.timestamp,
            order: options?.order,
        });
        const raw = await this.request<MirrorNetworkFeesResponse>(path);
        assertNetworkFeesResponse(raw, path);
        return convertNetworkFees(raw);
    }

    // ─── NFT provenance ──────────────────────────────────────────

    /** An NFT serial's transaction history (mint, transfers, approvals). */
    queryNftTransactions(
        tokenId: string,
        serialNumber: number,
        options?: NftTransactionsQuery,
    ): Promise<Page<NftTransaction>> {
        return this.getPage(
            appendQuery(
                `/api/v1/tokens/${segment(tokenId)}/nfts/${segment(serialNumber)}/transactions`,
                {
                    timestamp: options?.timestamp,
                    limit: options?.limit,
                    order: options?.order,
                },
            ),
            convertNftTransaction,
        );
    }

    // ─── Blocks ──────────────────────────────────────────────────

    /** List blocks (record files), newest first by default. */
    queryBlocks(options?: BlocksQuery): Promise<Page<Block>> {
        return this.getPage(
            appendQuery("/api/v1/blocks", {
                "block.number": options?.blockNumber,
                timestamp: options?.timestamp,
                limit: options?.limit,
                order: options?.order,
            }),
            convertBlock,
        );
    }

    /** Look up one block by its hash (eth or hedera format) or height. */
    async queryBlock(hashOrNumber: string | number): Promise<Block> {
        const path = `/api/v1/blocks/${segment(hashOrNumber)}`;
        const raw = await this.request<MirrorBlock>(path);
        assertBlockResponse(raw, path);
        return convertBlock(raw);
    }

    // ─── Hooks ───────────────────────────────────────────────────

    /** List the hooks attached to an account. */
    queryHooks(accountId: string, options?: HooksQuery): Promise<Page<Hook>> {
        return this.getPage(
            appendQuery(`/api/v1/accounts/${segment(accountId)}/hooks`, {
                "hook.id": options?.hookId,
                limit: options?.limit,
                order: options?.order,
            }),
            convertHook,
        );
    }

    /** List a hook's storage slots. */
    queryHookStorage(
        accountId: string,
        hookId: number,
        options?: HookStorageQuery,
    ): Promise<Page<HookStorageSlot>> {
        return this.getPage(
            appendQuery(
                `/api/v1/accounts/${segment(accountId)}/hooks/${segment(hookId)}/storage`,
                {
                    key: options?.key,
                    timestamp: options?.timestamp,
                    limit: options?.limit,
                    order: options?.order,
                },
            ),
            convertHookStorageSlot,
        );
    }

    // ─── Registered nodes ────────────────────────────────────────

    /** List registered (non-consensus) nodes. */
    queryRegisteredNodes(
        options?: RegisteredNodesQuery,
    ): Promise<Page<RegisteredNode>> {
        return this.getPage(
            appendQuery("/api/v1/network/registered-nodes", {
                "registerednode.id": options?.registeredNodeId,
                type: options?.type,
                limit: options?.limit,
                order: options?.order,
            }),
            convertRegisteredNode,
        );
    }

    // ─── Contracts (EVM read surface) ────────────────────────────

    /** List contract entities on the network. */
    queryContracts(options?: ContractsQuery): Promise<Page<MirrorContract>> {
        return this.getPage(
            appendQuery("/api/v1/contracts", {
                "contract.id": options?.contractId,
                limit: options?.limit,
                order: options?.order,
            }),
            convertContract,
        );
    }

    /**
     * Look up one contract — including its bytecode — by entity ID or EVM
     * address, optionally as of a point in time.
     */
    async queryContract(
        contractIdOrAddress: string,
        options?: ContractQuery,
    ): Promise<MirrorContractDetail> {
        const path = appendQuery(
            `/api/v1/contracts/${segment(contractIdOrAddress)}`,
            {
                timestamp: options?.timestamp,
            },
        );
        const raw = await this.request<MirrorContractResponse>(path);
        assertContractResponse(raw, path);
        return convertContractDetail(raw);
    }

    /** List one contract's function execution results. */
    queryContractResults(
        contractIdOrAddress: string,
        options?: ContractResultsQuery,
    ): Promise<Page<ContractResult>> {
        return this.getPage(
            appendQuery(
                `/api/v1/contracts/${segment(contractIdOrAddress)}/results`,
                contractResultsQueryParams(options),
            ),
            convertContractResult,
        );
    }

    /** List function execution results across all contracts. */
    queryAllContractResults(
        options?: ContractResultsQuery,
    ): Promise<Page<ContractResult>> {
        return this.getPage(
            appendQuery(
                "/api/v1/contracts/results",
                contractResultsQueryParams(options),
            ),
            convertContractResult,
        );
    }

    /**
     * The detailed result — logs and state changes included — of the
     * execution a contract ran at a given consensus timestamp.
     */
    async queryContractResultByTimestamp(
        contractIdOrAddress: string,
        timestamp: string,
    ): Promise<ContractResultDetails> {
        const path = `/api/v1/contracts/${segment(contractIdOrAddress)}/results/${segment(timestamp)}`;
        const raw = await this.request<MirrorContractResultDetails>(path);
        assertContractResultResponse(raw, path);
        return convertContractResultDetails(raw);
    }

    /**
     * The detailed result of an execution, by transaction ID or ethereum
     * transaction hash.
     */
    async queryContractResult(
        transactionIdOrHash: string,
        options?: ContractResultQuery,
    ): Promise<ContractResultDetails> {
        const path = appendQuery(
            `/api/v1/contracts/results/${segment(transactionIdOrHash)}`,
            { nonce: options?.nonce },
        );
        const raw = await this.request<MirrorContractResultDetails>(path);
        assertContractResultResponse(raw, path);
        return convertContractResultDetails(raw);
    }

    /** The call frames (internal calls) of an execution. */
    queryContractActions(
        transactionIdOrHash: string,
        options?: ContractActionsQuery,
    ): Promise<Page<ContractAction>> {
        return this.getPage(
            appendQuery(
                `/api/v1/contracts/results/${segment(transactionIdOrHash)}/actions`,
                {
                    index: options?.index,
                    limit: options?.limit,
                    order: options?.order,
                },
            ),
            convertContractAction,
        );
    }

    /**
     * Re-execute a transaction and return its full opcode trace. Slow —
     * the EVM replays the transaction; request memory/storage only when
     * needed.
     */
    async queryContractOpcodes(
        transactionIdOrHash: string,
        options?: OpcodesQuery,
    ): Promise<OpcodeTrace> {
        const path = appendQuery(
            `/api/v1/contracts/results/${segment(transactionIdOrHash)}/opcodes`,
            {
                stack: options?.stack,
                memory: options?.memory,
                storage: options?.storage,
            },
        );
        const raw = await this.request<MirrorOpcodesResponse>(path);
        assertOpcodesResponse(raw, path);
        return convertOpcodeTrace(raw);
    }

    /** A contract's storage slots — current, or as of a point in time. */
    queryContractState(
        contractIdOrAddress: string,
        options?: ContractStateQuery,
    ): Promise<Page<ContractStateEntry>> {
        return this.getPage(
            appendQuery(
                `/api/v1/contracts/${segment(contractIdOrAddress)}/state`,
                {
                    slot: options?.slot,
                    timestamp: options?.timestamp,
                    limit: options?.limit,
                    order: options?.order,
                },
            ),
            convertContractState,
        );
    }

    /**
     * Search one contract's event logs. Topic filters require a
     * `timestamp` range of at most seven days.
     */
    queryContractLogs(
        contractIdOrAddress: string,
        options?: ContractLogsQuery,
    ): Promise<Page<ContractLog>> {
        return this.getPage(
            appendQuery(
                `/api/v1/contracts/${segment(contractIdOrAddress)}/results/logs`,
                contractLogsQueryParams(options),
            ),
            convertContractLog,
        );
    }

    /** Search event logs across all contracts. */
    queryAllContractLogs(
        options?: ContractLogsQuery,
    ): Promise<Page<ContractLog>> {
        return this.getPage(
            appendQuery("/api/v1/contracts/results/logs", {
                ...contractLogsQueryParams(options),
                "transaction.hash": options?.transactionHash,
            }),
            convertContractLog,
        );
    }

    /**
     * Execute a read-only contract call, estimate gas, or simulate a
     * read-write operation without submitting a transaction
     * (`POST /api/v1/contracts/call`). Free and keyless, like every other
     * mirror query; runs through the same rate gate.
     */
    async queryContractCall(
        request: ContractCallRequest,
    ): Promise<ContractCallResult> {
        const path = "/api/v1/contracts/call";
        const raw = await this.request<MirrorContractCallResponse>(
            path,
            request,
        );
        assertContractCallResponse(raw, path);
        return { result: raw.result };
    }

    // ─── Pagination ──────────────────────────────────────────────

    /**
     * Fetch a single page and wrap it as a continuable {@link Page} — its
     * `next()` re-fetches the following page with the same converter, so
     * callers (or the `collectAll` / `paginate` helpers) can walk the whole
     * listing without ever re-declaring the path. Every page goes through
     * the concurrency/rate gate.
     */
    private async getPage<TOut>(
        path: string,
        converter: (raw: never) => TOut,
    ): Promise<Page<TOut>> {
        const raw: unknown = await this.request(path);
        assertPageResponse(raw, path);
        const { data, links, timestamp } = convertPage(
            raw as MirrorPageResponse<never>,
            converter,
        );
        // Balance-family responses carry the mirror's snapshot timestamp,
        // but their next-page links do NOT — so unpinned pagination can
        // straddle two snapshots if a new one lands mid-drain. Pin the
        // snapshot onto the next link to keep every page consistent.
        let nextLink = links.next;
        if (
            nextLink !== null &&
            timestamp != null &&
            !nextLink.includes("timestamp=")
        ) {
            nextLink +=
                (nextLink.includes("?") ? "&" : "?") +
                `timestamp=${encodeURIComponent(timestamp)}`;
        }
        return {
            data,
            links: { ...links, next: nextLink },
            ...(timestamp !== undefined && { timestamp }),
            next: nextLink
                ? () => this.getPage(nextLink as string, converter)
                : null,
        };
    }

    /**
     * Fetch the next page from a raw pagination link. Low-level escape
     * hatch — prefer the continuable `Page.next()` returned by the `query*`
     * methods, or the `collectAll` / `paginate` helpers.
     */
    fetchNextPage<T>(
        nextLink: string,
        converter: (raw: unknown) => T,
    ): Promise<Page<T>> {
        return this.getPage(nextLink, converter as (raw: never) => T);
    }
}
