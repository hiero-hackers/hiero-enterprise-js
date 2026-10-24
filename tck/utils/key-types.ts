// Adapted from hiero-ledger/hiero-sdk-js tck/ (Apache-2.0): key parsing and
// generation are test plumbing, kept identical so key handling matches the
// reference adapter.
export interface KeyGenerationParams {
    readonly type: string;
    readonly fromKey?: string;
    readonly threshold?: number;
    readonly keys?: KeyGenerationParams[];
    readonly sessionId?: string;
}

export interface KeyGenerationResponse {
    key: string;
    privateKeys: string[];
}

export interface Asn1DecodedKeyResponse {
    readonly keyTypes: string[];
    readonly isPublicKey: boolean;
    readonly isKeyListHex: boolean;
}
