import { validationError } from "../../../errors/index.js";
import type { TopicDeleteOperationOptions } from "../operations/index.js";

/**
 * Validates `TopicDeleteOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TopicDeleteValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TopicDeleteOperationOptions): void {
        this.validateTopicId(options);
    }

    private validateTopicId(options: TopicDeleteOperationOptions): void {
        if (options.topicId == null) {
            throw validationError(
                "TopicDeleteValidator",
                "topicId is required.",
            );
        }

        if (
            typeof options.topicId === "string" &&
            options.topicId.trim().length === 0
        ) {
            throw validationError(
                "TopicDeleteValidator",
                "topicId cannot be empty.",
            );
        }
    }
}
