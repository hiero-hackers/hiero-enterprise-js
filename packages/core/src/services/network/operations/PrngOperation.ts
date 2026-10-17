import { PrngTransaction } from "@hiero-ledger/sdk";
import { HieroError, HieroErrorCodes } from "../../../errors/index.js";
import { BaseOperation } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { PrngValidator } from "../validation/index.js";

/**
 * Options for requesting a pseudo-random number from the network
 * (`PrngTransaction`, HIP-351).
 */
export interface PrngOptions extends TransactionOptions {
    /**
     * Upper bound (exclusive) for a random integer in `[0, range)`. Omit it
     * to get 384 bits of random bytes instead.
     */
    range?: number;
}

export class PrngOperation extends BaseOperation<PrngOptions> {
    protected readonly type = "UtilPrng";
    protected readonly serviceName = "NetworkService";
    protected readonly methodName = "generateRandom";
    protected readonly validator = new PrngValidator();

    /**
     * Submit the transaction and read the random value from its record,
     * where the network puts it (the receipt doesn't carry it).
     *
     * @throws HieroError with code `RESULT_MAPPING_FAILED` when the
     *   transaction reached consensus but the record lookup failed.
     */
    async execute(options: PrngOptions = {}) {
        const results = await this.run(options);

        let record;
        try {
            record = await results.response.getRecord(this.context.client);
        } catch (error) {
            // The transaction landed; a plain rethrow would read as a failed
            // transaction and invite a resubmit.
            const reason =
                error instanceof Error ? error.message : String(error);
            throw new HieroError(
                `PRNG transaction ${results.transactionId} reached consensus ` +
                    `with status ${results.status}, but fetching its record ` +
                    `(which carries the random value) failed: ${reason}. ` +
                    `Look the record up by the transaction id.`,
                {
                    code: HieroErrorCodes.ResultMappingFailed,
                    context: "NetworkService.generateRandom",
                    transactionId: results.transactionId,
                    cause: error,
                },
            );
        }

        return {
            ...results,
            prngNumber: record.prngNumber,
            prngBytes: record.prngBytes,
        };
    }

    protected build(options: PrngOptions): PrngTransaction {
        const tx = new PrngTransaction();
        if (options.range != null) {
            tx.setRange(options.range);
        }
        return tx;
    }
}
