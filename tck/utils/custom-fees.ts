// Adapted from hiero-ledger/hiero-sdk-js tck/utils/helpers/token.ts (Apache-2.0):
// builds SDK custom fees from the TCK's JSON, as the reference adapter does.
import type { CustomFee } from "@hiero-ledger/sdk";
import {
    AccountId,
    CustomFixedFee,
    CustomFractionalFee,
    CustomRoyaltyFee,
    FeeAssessmentMethod,
    Long,
} from "@hiero-ledger/sdk";

export const createCustomFees = (
    customFees: // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the TCK's untyped fee JSON
    Array<Record<string, any>>,
) => {
    const customFeeList: Array<CustomFee> = [];

    customFees.forEach((customFee) => {
        // Set fixed fees
        if (customFee.fixedFee) {
            const fixedFee = new CustomFixedFee()
                .setAmount(Long.fromString(customFee.fixedFee.amount))
                .setFeeCollectorAccountId(
                    AccountId.fromString(customFee.feeCollectorAccountId),
                )
                .setAllCollectorsAreExempt(customFee.feeCollectorsExempt)
                .setDenominatingTokenId(customFee.fixedFee.denominatingTokenId);

            customFeeList.push(fixedFee);
        }

        // Set fractional fees
        if (customFee.fractionalFee) {
            const fractionalFee = new CustomFractionalFee()
                .setNumerator(
                    Long.fromString(customFee.fractionalFee.numerator),
                )
                .setDenominator(
                    Long.fromString(customFee.fractionalFee.denominator),
                )
                .setMin(Long.fromString(customFee.fractionalFee.minimumAmount))
                .setMax(Long.fromString(customFee.fractionalFee.maximumAmount))
                .setFeeCollectorAccountId(
                    AccountId.fromString(customFee.feeCollectorAccountId),
                )
                .setAllCollectorsAreExempt(customFee.feeCollectorsExempt)
                .setAssessmentMethod(
                    customFee.fractionalFee.assessmentMethod === "inclusive"
                        ? FeeAssessmentMethod.Inclusive
                        : FeeAssessmentMethod.Exclusive,
                );

            customFeeList.push(fractionalFee);
        }

        // Set royalty fees
        if (customFee.royaltyFee) {
            const royaltyFee = new CustomRoyaltyFee()
                .setNumerator(Long.fromString(customFee.royaltyFee.numerator))
                .setDenominator(
                    Long.fromString(customFee.royaltyFee.denominator),
                )
                .setFeeCollectorAccountId(
                    AccountId.fromString(customFee.feeCollectorAccountId),
                )
                .setAllCollectorsAreExempt(customFee.feeCollectorsExempt);

            if (customFee.royaltyFee.fallbackFee) {
                const fallbackFee = new CustomFixedFee()
                    .setAmount(
                        Long.fromString(
                            customFee.royaltyFee.fallbackFee.amount,
                        ),
                    )
                    .setDenominatingTokenId(
                        customFee.royaltyFee.fallbackFee.denominatingTokenId,
                    );

                royaltyFee.setFallbackFee(fallbackFee);
            }

            customFeeList.push(royaltyFee);
        }
    });

    return customFeeList;
};
