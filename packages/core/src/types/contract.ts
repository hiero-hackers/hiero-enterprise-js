/**
 * Result of a smart contract function call.
 */
export interface ContractCallResult {
    /** Gas consumed by the call */
    gasUsed: number;
    /** HBAR result (in tinybars) */
    hbarResult?: number;
    /** Contract ID that was called */
    contractId: string;
    /** Raw result bytes (hex encoded) */
    resultBytes?: string;
    /** Error message if the call failed */
    errorMessage?: string;
}
