/**
 * Shared primitives used across the domain type modules.
 */

/**
 * The kind of key the mirror node reports via a key's `_type` discriminator:
 *
 * - `ED25519` / `ECDSA_SECP256K1` — a simple public key; `MirrorKey.key` is the
 *   raw public key hex.
 * - `ProtobufEncoded` — a **complex key** (threshold key or key list);
 *   `MirrorKey.key` is a protobuf-encoded structure, not a single public key.
 *   Decode it yourself if you need the sub-keys — this package stays
 *   dependency-free and does not pull in protobuf machinery.
 *
 * Written as a union with a `string` fallback so the known kinds autocomplete
 * and can be `switch`ed exhaustively, while an as-yet-unknown kind the mirror
 * node may add still passes through unchanged.
 */
export type MirrorKeyType =
    | "ED25519"
    | "ECDSA_SECP256K1"
    | "ProtobufEncoded"
    | (string & {});

/**
 * A key as the mirror node reports it: the serialized key material plus the
 * algorithm/kind that produced it. The mirror node returns keys as
 * `{ "_type": "...", "key": "..." }`; this is the domain-model counterpart.
 *
 * Check {@link type} before trusting {@link key} to be a simple public key —
 * when `type` is `"ProtobufEncoded"`, `key` is a threshold key / key list.
 */
export interface MirrorKey {
    /**
     * Serialized key material (hex, as the mirror node returns it). A raw
     * public key for `ED25519`/`ECDSA_SECP256K1`; a protobuf-encoded complex
     * key when {@link type} is `"ProtobufEncoded"`.
     */
    key: string;
    /**
     * Key kind — the algorithm, or `"ProtobufEncoded"` for a complex key.
     * Optional because not every recorded payload carries it, though the live
     * mirror node always does.
     */
    type?: MirrorKeyType;
}

/**
 * A timestamp range as reported by the mirror node — `to` is null while
 * the record is still current.
 */
export interface EffectiveTimestampRange {
    from: string;
    to: string | null;
}
