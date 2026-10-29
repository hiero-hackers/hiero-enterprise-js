const encoder = new TextEncoder();

/**
 * Number of bytes `value` takes as UTF-8, for byte-limited fields such as
 * memos, token names and symbols. Works in Node, browsers and React Native.
 */
export function utf8ByteLength(value: string): number {
    return encoder.encode(value).length;
}
