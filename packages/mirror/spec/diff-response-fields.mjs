/**
 * Maintainer tool: diff the vendored spec's RESPONSE schemas against the
 * raw wire types in src/types/mirror-node.ts.
 *
 *   node spec/diff-response-fields.mjs        (from packages/mirror)
 *
 * Complements the request-side guarantee of test/unit/spec-coverage.test.ts:
 * that test proves every query parameter is expressible; this script reports
 * response fields the spec defines that the raw types don't carry (converters
 * silently drop unknown fields, so gaps here mean data consumers can't reach).
 *
 * Four checks:
 *  1. Reachability — every structural schema reachable from a 200/206
 *     response must be mapped, a known wrapper, or explicitly ignored.
 *  2. Named-pair field diff (spec schema ↔ raw interface).
 *  3. Inline-schema diff for item shapes the spec doesn't name
 *     (transaction transfer legs).
 *  4. int64 classification — every spec `type: integer, format: int64`
 *     response field must be typed `MirrorAmount` (the lossless parse can
 *     quote it) or appear in the COUNTERS allowlist with a reason. This
 *     mechanizes the amount/counter line documented on `MirrorAmount`, so
 *     the #136 bug class cannot be reintroduced by a new field.
 */
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const spec = parse(
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- constant path derived from import.meta.url, no user input
    readFileSync(
        fileURLToPath(new URL("./openapi.yml", import.meta.url)),
        "utf8",
    ),
);
const schemas = new Map(Object.entries(spec.components.schemas));
// eslint-disable-next-line security/detect-non-literal-fs-filename -- constant path derived from import.meta.url, no user input
const source = readFileSync(
    fileURLToPath(new URL("../src/types/mirror-node.ts", import.meta.url)),
    "utf8",
);

/** Flatten a schema node's property names, resolving $ref and allOf. */
function props(node) {
    const out = new Set();
    const walk = (n) => {
        if (!n) return;
        if (n.$ref) return walk(schemas.get(n.$ref.split("/").pop()));
        for (const sub of n.allOf ?? []) walk(sub);
        for (const key of Object.keys(n.properties ?? {})) out.add(key);
    };
    walk(node);
    return out;
}

/** Every raw interface's keys, with `extends` chains resolved. */
const parsed = new Map(
    source
        .split(/\binterface /)
        .slice(1)
        .map((chunk) => {
            const body = chunk.slice(0, chunk.indexOf("\n}"));
            const name = /^(\w+)/.exec(body);
            const parent = / extends (\w+)/.exec(body);
            return [
                name[1],
                {
                    parent: parent?.[1],
                    own: new Set(
                        [...body.matchAll(/^\s{4}([a-z_0-9]+)\??:/gm)].map(
                            (key) => key[1],
                        ),
                    ),
                    // Field → declared type text, for the int64 check.
                    // Multi-line (inline-object) types capture garbage,
                    // which is fine: the spec types those as objects, so
                    // the int64 check never consults them.
                    ownTypes: new Map(
                        [
                            ...body.matchAll(
                                /^\s{4}([a-z_0-9]+)\??:\s*([^;]+);/gm,
                            ),
                        ].map((m) => [m[1], m[2]]),
                    ),
                },
            ];
        }),
);
const interfaces = new Map(
    [...parsed.keys()].map((name) => {
        const keys = new Set();
        for (let cur = name; cur; cur = parsed.get(cur)?.parent)
            for (const key of parsed.get(cur)?.own ?? []) keys.add(key);
        return [name, keys];
    }),
);
const interfaceTypes = new Map(
    [...parsed.keys()].map((name) => {
        const types = new Map();
        for (let cur = name; cur; cur = parsed.get(cur)?.parent)
            for (const [key, text] of parsed.get(cur)?.ownTypes ?? [])
                if (!types.has(key)) types.set(key, text);
        return [name, types];
    }),
);

/** Spec schema → raw interface (`extends` chains are resolved). */
const PAIRS = [
    ["AccountInfo", "MirrorAccountResponse"],
    ["AccountBalance", "MirrorAccountBalanceSnapshot"],
    ["Transaction", "MirrorTransaction"],
    ["TransactionDetail", "MirrorTransaction"],
    ["AssessedCustomFee", "MirrorAssessedCustomFee"],
    ["CustomFeeLimit", "MirrorCustomFeeLimit"],
    ["StakingRewardTransfer", "MirrorStakingRewardTransfer"],
    // The list schema is a 7-field summary with integer decimals — a
    // DIFFERENT shape from TokenInfo (string decimals, supply fields).
    ["Token", "MirrorTokenListRow"],
    ["TokenInfo", "MirrorTokenResponse"],
    ["TokenBalance", "MirrorTokenBalance"],
    ["TokenRelationship", "MirrorAccountTokenBalance"],
    ["FixedFee", "MirrorFixedFeeRaw"],
    ["FractionalFee", "MirrorFractionalFeeRaw"],
    ["RoyaltyFee", "MirrorRoyaltyFeeRaw"],
    ["Nft", "MirrorNft"],
    ["NftTransactionTransfer", "MirrorNftTransaction"],
    ["TopicMessage", "MirrorTopicMessageRaw"],
    ["ChunkInfo", "MirrorChunkInfo"],
    ["Topic", "MirrorTopicResponse"],
    ["Schedule", "MirrorScheduleResponse"],
    ["ScheduleSignature", "MirrorScheduleSignature"],
    ["Block", "MirrorBlock"],
    ["Contract", "MirrorContractRaw"],
    ["ContractResponse", "MirrorContractResponse"],
    ["ContractResult", "MirrorContractResult"],
    ["ContractResultLog", "MirrorContractResultLog"],
    ["ContractResultStateChange", "MirrorContractStateChange"],
    ["ContractAction", "MirrorContractAction"],
    ["ContractState", "MirrorContractState"],
    ["ContractCallResponse", "MirrorContractCallResponse"],
    ["AccessList", "MirrorAccessListEntry"],
    ["AuthorizationList", "MirrorAuthorizationListEntry"],
    ["Opcode", "MirrorOpcode"],
    ["OpcodesResponse", "MirrorOpcodesResponse"],
    ["NetworkNode", "MirrorNetworkNode"],
    ["ServiceEndpoint", "MirrorServiceEndpoint"],
    ["RegisteredNode", "MirrorRegisteredNode"],
    ["RegisteredServiceEndpoint", "MirrorRegisteredServiceEndpoint"],
    ["RegisteredBlockNodeEndpoint", "MirrorRegisteredServiceEndpoint"],
    ["RegisteredGeneralServiceEndpoint", "MirrorRegisteredServiceEndpoint"],
    ["NetworkStakeResponse", "MirrorNetworkStakeResponse"],
    ["NetworkSupplyResponse", "MirrorNetworkSupplyResponse"],
    ["NetworkFeesResponse", "MirrorNetworkFeesResponse"],
    ["ExchangeRate", "MirrorExchangeRate"],
    ["StakingReward", "MirrorStakingReward"],
    ["TokenAirdrop", "MirrorAirdrop"],
    ["Allowance", "MirrorCryptoAllowance"],
    ["CryptoAllowance", "MirrorCryptoAllowance"],
    ["TokenAllowance", "MirrorTokenAllowance"],
    ["NftAllowance", "MirrorNftAllowance"],
    ["Hook", "MirrorHook"],
    ["HookStorage", "MirrorHookStorageSlot"],
    ["FeeEstimateResponse", "MirrorFeeEstimateResponse"],
    ["FeeExtra", "MirrorFeeExtra"],
    ["FeeEstimate", "MirrorFeeEstimateComponent"],
    ["TimestampRange", "MirrorTimestampRange"],
    ["TimestampRangeNullable", "MirrorTimestampRange"],
];

/** List/page wrappers — their items are covered by PAIRS. */
const WRAPPERS = new Set([
    "AccountsResponse",
    "BalancesResponse",
    "BlocksResponse",
    "ContractActionsResponse",
    "ContractLogsResponse",
    "ContractResultsResponse",
    "ContractStateResponse",
    "ContractsResponse",
    "CryptoAllowancesResponse",
    "HooksResponse",
    "HooksStorageResponse",
    "NetworkExchangeRateSetResponse",
    "NetworkNodesResponse",
    "Nfts",
    "NftAllowancesResponse",
    "NftTransactionHistory",
    "RegisteredNodesResponse",
    "SchedulesResponse",
    "StakingRewardsResponse",
    "TokenAirdropsResponse",
    "TokenAllowancesResponse",
    "TokenBalancesResponse",
    "TokenRelationshipResponse",
    "TokensResponse",
    "TopicMessagesResponse",
    "TransactionByIdResponse",
    "TransactionsResponse",
]);

/** Deliberately unmapped, with reasons. */
const IGNORED = new Map([
    ["Links", "pagination plumbing (handled by Page)"],
    ["Key", "flattened to its `key` string by converters"],
    ["Balance", "inline balance object inside MirrorAccountResponse"],
    ["TransactionId", "inline object inside MirrorChunkInfo"],
    ["CustomFees", "inline container inside MirrorTokenResponse"],
    ["ConsensusCustomFees", "inline container inside MirrorTopicResponse"],
    ["FixedCustomFee", "inline topic fixed-fee inside MirrorTopicResponse"],
    [
        "ContractLog",
        "extends ContractResultLog — own fields on MirrorContractLog",
    ],
    [
        "ContractResultDetails",
        "extends ContractResult — own fields on MirrorContractResultDetails",
    ],
    [
        "AccountBalanceTransactions",
        "AccountInfo + embedded transactions list (documented omission)",
    ],
    [
        "FeeEstimateNetwork",
        "inline network component inside MirrorFeeEstimateResponse",
    ],
    ["NetworkFee", "inline fees entry inside MirrorNetworkFeesResponse"],
]);

// ── 1 · reachability ────────────────────────────────────────────
const reachable = new Set();
const visitRef = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.$ref) {
        const name = node.$ref.split("/").pop();
        if (!reachable.has(name)) {
            reachable.add(name);
            visitRef(schemas.get(name));
        }
        return;
    }
    for (const variants of [node.allOf, node.oneOf, node.anyOf])
        for (const sub of variants ?? []) visitRef(sub);
    if (node.items) visitRef(node.items);
    if (node.additionalProperties) visitRef(node.additionalProperties);
    for (const prop of Object.values(node.properties ?? {})) visitRef(prop);
};
for (const ops of Object.values(spec.paths))
    for (const op of Object.values(ops))
        for (const [code, resp] of Object.entries(op.responses ?? {}))
            if (code === "200" || code === "206")
                visitRef(resp.content?.["application/json"]?.schema);

const mapped = new Set(PAIRS.map(([schema]) => schema));
const hasProps = (n) =>
    n && (n.properties || (n.allOf ?? []).some((sub) => hasProps(sub)));
const unaccounted = [...reachable]
    .filter((name) => hasProps(schemas.get(name)))
    .filter(
        (name) =>
            !mapped.has(name) && !WRAPPERS.has(name) && !IGNORED.has(name),
    )
    .sort();
if (unaccounted.length) {
    console.log(`✖ UNACCOUNTED reachable schemas: ${unaccounted.join(", ")}`);
} else {
    console.log(
        `✓ reachability: all ${reachable.size} reachable schemas mapped, wrapped, or ignored with a reason`,
    );
}

// ── 2 · named-pair field diff ───────────────────────────────────
let gaps = 0;
for (const [schema, iface] of PAIRS) {
    const specFields = props(schemas.get(schema));
    const rawFields = interfaces.get(iface);
    if (specFields.size === 0 || !rawFields) {
        console.log(`?? could not resolve ${schema} → ${iface}`);
        gaps += 1;
        continue;
    }
    const missing = [...specFields].filter((f) => !rawFields.has(f)).sort();
    if (missing.length) {
        gaps += missing.length;
        console.log(`● ${schema} → ${iface}: missing ${missing.join(", ")}`);
    }
}

// ── 3 · inline item shapes ──────────────────────────────────────
// Shapes the spec doesn't name (or names as a bare array schema, which
// check 1's `hasProps` cannot see — TokenDistribution is the original
// #136 whale-balance listing and must not escape).
const transaction = schemas.get("Transaction").properties;
const INLINE_ITEMS = [
    ["Transaction.transfers", transaction.transfers.items, "MirrorTransfer"],
    [
        "Transaction.token_transfers",
        transaction.token_transfers.items,
        "MirrorTokenTransfer",
    ],
    [
        "Transaction.nft_transfers",
        transaction.nft_transfers.items,
        "MirrorNftTransfer",
    ],
    [
        "TokenDistribution[]",
        schemas.get("TokenDistribution").items,
        "MirrorTokenHolderBalance",
    ],
];
for (const [label, items, iface] of INLINE_ITEMS) {
    const specFields = props(items);
    const rawFields = interfaces.get(iface);
    const missing = [...specFields].filter((f) => !rawFields.has(f)).sort();
    if (missing.length) {
        gaps += missing.length;
        console.log(`● ${label} → ${iface}: missing ${missing.join(", ")}`);
    }
}

console.log(
    gaps === 0
        ? "✓ field diff: 0 spec response fields missing from raw types"
        : `✖ ${gaps} spec response fields missing from raw types`,
);

// ── 4 · int64 classification ────────────────────────────────────
// The #136 bug class: the lossless parse quotes ANY bare integer of 16+
// digits, so every spec int64 response field can arrive as a string. A
// field typed plain `number` is therefore a latent type-lie — unless it
// is a monotonic counter or network-computed quote that cannot plausibly
// reach 16 digits, recorded here WITH ITS REASON. A ✖ from this check
// means: classify the new field, deliberately.
const COUNTERS = new Map([
    ["serial_number", "monotonic per-token mint counter"],
    ["sequence_number", "monotonic per-topic message counter"],
    ["nonce", "account/contract transaction counter, network-incremented"],
    ["ethereum_nonce", "account transaction counter, network-incremented"],
    ["node_id", "small node identifier"],
    ["registered_node_id", "small node identifier"],
    ["staked_node_id", "small node identifier (or -1 when unset)"],
    ["staking_period_duration", "network config, minutes"],
    ["staking_periods_stored", "network config, small count"],
    ["expiration_time", "epoch seconds — 10 digits until year ~33658"],
    ["auto_renew_period", "seconds duration, network-validated (~90 days)"],
    ["decimals", "token decimal places, protocol-bounded"],
    ["block_number", "monotonic block counter"],
    ["transaction_index", "position within a block, small"],
    // Two distinct fields, one per schema: FeeEstimateResponse carries
    // high_volume_multiplier, Transaction carries the _pricing_ variant.
    ["high_volume_multiplier", "small network-set multiplier"],
    ["high_volume_pricing_multiplier", "small network-set multiplier"],
    ["gas_cost", "static per-opcode cost from the EVM fee table"],
    ["count", "usage count"],
    ["included", "usage count covered by the base fee"],
    ["total", "network-computed fee quote, tinycents"],
    ["charged", "network-computed fee quote, tinycents"],
    ["fee_per_unit", "network-computed fee quote, tinycents"],
    ["subtotal", "network-computed fee quote, tinycents"],
    ["base", "network-computed fee quote, tinycents"],
    // Qualified entries — the reason binds to ONE schema's field.
    [
        "TokenInfo.expiry_timestamp",
        "epoch nanos as number|string union — the string arm is the lossless quote, normalized digit-exact by normalizeTokenExpiry",
    ],
]);

/**
 * Spec int64 test, OpenAPI-3.1-aware: nullable fields carry
 * `type: ["integer", "null"]`, and a plain `!== "integer"` comparison
 * silently skips every one of them — which is how amounts/stakes once
 * escaped this check entirely.
 */
const isInt64 = (prop) => {
    const types = Array.isArray(prop.type) ? prop.type : [prop.type];
    return types.includes("integer") && prop.format === "int64";
};

/** A property's effective scalar schema, `$ref`s resolved. */
function typedProps(node) {
    const out = new Map();
    const walk = (n) => {
        if (!n) return;
        if (n.$ref) return walk(schemas.get(n.$ref.split("/").pop()));
        for (const sub of n.allOf ?? []) walk(sub);
        for (const [key, prop] of Object.entries(n.properties ?? {})) {
            let p = prop;
            while (p?.$ref) p = schemas.get(p.$ref.split("/").pop());
            if (!out.has(key)) out.set(key, p ?? {});
        }
    };
    walk(node);
    return out;
}

let unclassified = 0;
const checkInt64 = (label, specNode, iface) => {
    const rawTypes = interfaceTypes.get(iface);
    if (!rawTypes) return;
    for (const [field, prop] of typedProps(specNode)) {
        if (!isInt64(prop)) continue;
        const text = rawTypes.get(field);
        if (!text) continue; // absence is check 2's report
        if (text.includes("MirrorAmount")) continue;
        if (!/\bnumber\b/.test(text)) continue; // wire string — already safe
        // Qualified (`Schema.field`) entries bind a reason to one schema;
        // bare names are legacy and bless the name everywhere — prefer
        // qualified for new entries.
        if (COUNTERS.has(`${label}.${field}`) || COUNTERS.has(field)) continue;
        unclassified += 1;
        console.log(
            `✖ ${label}.${field}: spec int64 typed \`${text.trim()}\` — make it MirrorAmount, or allowlist it as a counter with a reason`,
        );
    }
};
for (const [schema, iface] of PAIRS)
    checkInt64(schema, schemas.get(schema), iface);
for (const [label, items, iface] of INLINE_ITEMS)
    checkInt64(label, items, iface);

// ── 4b · nested int64s ──────────────────────────────────────────
// The flat check reads one interface's direct fields, so an int64 inside
// an inline object (`fallback_fee.amount`) or a $ref the PAIRS table
// doesn't cover (AccountInfo.balance → Balance) is invisible to it. This
// walk DISCOVERS every such nested int64 from the spec; each discovered
// path must be classified in NESTED — either a source regex proving the
// raw type is MirrorAmount, or a counter reason. An unclassified path
// fails the run, so a future nested spec field cannot slip through.
const NESTED = new Map([
    [
        "AccountInfo.balance.balance",
        /balance\?: \{[\s\S]{0,200}?balance: MirrorAmount/,
    ],
    [
        "FractionalFee.amount.numerator",
        /numerator: MirrorAmount; denominator: MirrorAmount/,
    ],
    [
        "FractionalFee.amount.denominator",
        /numerator: MirrorAmount; denominator: MirrorAmount/,
    ],
    [
        "RoyaltyFee.amount.numerator",
        /numerator: MirrorAmount; denominator: MirrorAmount/,
    ],
    [
        "RoyaltyFee.amount.denominator",
        /numerator: MirrorAmount; denominator: MirrorAmount/,
    ],
    [
        "RoyaltyFee.fallback_fee.amount",
        /fallback_fee\?: \{\s*amount: MirrorAmount/,
    ],
    [
        // The array is typed by MirrorTokenBalance, whose `balance` the
        // flat check already enforces via the TokenBalance pair — this
        // regex pins the linkage so retyping the array breaks the run.
        "AccountInfo.balance.tokens[].balance",
        /tokens: MirrorTokenBalance\[\]/,
    ],
    [
        "Topic.custom_fees.fixed_fees[].amount",
        /fixed_fees\?: Array<\{\s*amount: MirrorAmount/,
    ],
    // Counters, with reasons — same bar as COUNTERS above.
    [
        "NetworkFeesResponse.fees[].gas",
        "network-computed gas price quote, tinycents — bounded",
    ],
    [
        "FeeEstimateResponse.network.subtotal",
        "network-computed fee quote, tinycents — bounded",
    ],
]);
const flatChecked = new Set([
    ...PAIRS.map(([schema]) => schema),
    "TokenDistribution",
]);
const inlineChecked = new Set(INLINE_ITEMS.map(([, items]) => items));
const findNestedInt64 = (label, node, path, depth, seenRefs) => {
    if (!node) return;
    if (node.$ref) {
        const name = node.$ref.split("/").pop();
        // A schema the flat check (or this walk) already covers.
        if (flatChecked.has(name) || seenRefs.has(name)) return;
        seenRefs.add(name);
        return findNestedInt64(label, schemas.get(name), path, depth, seenRefs);
    }
    for (const sub of node.allOf ?? [])
        findNestedInt64(label, sub, path, depth, seenRefs);
    // INLINE_ITEMS subtrees get their own flat check under their own
    // label — re-discovering them here would double-report every field.
    if (node.items && !inlineChecked.has(node.items))
        findNestedInt64(label, node.items, `${path}[]`, depth, seenRefs);
    for (const [key, prop] of Object.entries(node.properties ?? {})) {
        const at = path === "" ? key : `${path}.${key}`;
        if (isInt64(prop) && depth > 0) {
            const rule = NESTED.get(`${label}.${at}`);
            if (rule instanceof RegExp && rule.test(source)) continue;
            if (typeof rule === "string") continue; // counter, with reason
            unclassified += 1;
            console.log(
                `✖ nested int64 ${label}.${at}: classify it in NESTED — a MirrorAmount source regex, or a counter reason`,
            );
            continue;
        }
        findNestedInt64(label, prop, at, depth + 1, seenRefs);
    }
};
for (const [schema] of PAIRS)
    findNestedInt64(schema, schemas.get(schema), "", 0, new Set());
for (const [label, items] of INLINE_ITEMS)
    findNestedInt64(label, items, "", 0, new Set());

console.log(
    unclassified === 0
        ? `✓ int64 classification: every spec int64 field is MirrorAmount, wire-string, or an allowlisted counter (${COUNTERS.size} reasons recorded)`
        : `✖ ${unclassified} spec int64 fields lack a classification`,
);
// One assignment for all three failure signals — a second assignment
// would silently overwrite the first, turning a check non-enforcing.
process.exitCode =
    gaps === 0 && unaccounted.length === 0 && unclassified === 0 ? 0 : 1;
