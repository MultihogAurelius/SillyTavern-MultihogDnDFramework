/**
 * Character creation is successful only when the State Tracker committed a new
 * [CHARACTER] block. This prevents later persona/card steps from using stale or
 * empty state after a truncated model response.
 */
export function assertCharacterGenerationUpdatedMemo(memoBefore, memoAfter, requestResult) {
    const unchanged = requestResult?.changed === false || !memoAfter || memoAfter === memoBefore;
    if (unchanged || !/\[CHARACTER\]/i.test(memoAfter)) {
        const trackerDetail = requestResult?.message ? ` (${requestResult.message})` : '';
        throw new Error(`Character generation failed — State Model returned no character sheet${trackerDetail}. The response may have been truncated; check the connection and response-token limit.`);
    }
}
