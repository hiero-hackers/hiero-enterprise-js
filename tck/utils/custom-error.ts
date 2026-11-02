// Adapted from hiero-ledger/hiero-sdk-js tck/ (Apache-2.0): key parsing and
// generation are test plumbing, kept identical so key handling matches the
// reference adapter.
export class CustomError extends Error {
    code: number;

    constructor(message: string, code: number) {
        super(message);
        this.code = code;
    }
}
