const HEX_40 = /^[a-f0-9]{40}$/i;
const BTIH = /urn:btih:([a-f0-9]{40})/i;

/** Magnet URI or bare hex hash -> lowercase infohash. */
export function toInfoHash(input: string): string | null {
    const candidate = input.match(BTIH)?.[1] ?? input.trim();
    return HEX_40.test(candidate) ? candidate.toLowerCase() : null;
}

/** Magnet carrying nothing but the infohash. */
export const bareMagnet = (infoHash: string) => `magnet:?xt=urn:btih:${infoHash}`;

/** Walks one bencoded value, returning the offset just past it. */
function skipValue(buf: Uint8Array, start: number): number {
    const marker = buf[start];

    if (marker === 0x64 || marker === 0x6c) {
        // d / l — recurse until the matching 'e'
        let i = start + 1;
        while (buf[i] !== 0x65) {
            if (i >= buf.length) throw new Error("truncated");
            i = skipValue(buf, i);
        }
        return i + 1;
    }

    if (marker === 0x69) {
        // i<digits>e
        let i = start + 1;
        while (buf[i] !== 0x65) {
            if (i >= buf.length) throw new Error("truncated");
            i++;
        }
        return i + 1;
    }

    // <length>:<bytes>
    let length = 0;
    let i = start;
    while (buf[i] !== 0x3a) {
        if (i >= buf.length || buf[i] < 0x30 || buf[i] > 0x39) throw new Error("not bencode");
        length = length * 10 + (buf[i] - 0x30);
        i++;
    }

    const end = i + 1 + length;
    if (end > buf.length) throw new Error("truncated");
    return end;
}

/** SHA-1 over the raw bytes of the `info` dict — re-encoding it would change the hash. */
export async function torrentFileInfoHash(file: File): Promise<string | null> {
    // SubtleCrypto is absent outside a secure context, e.g. a LAN deployment over plain HTTP
    if (!globalThis.crypto?.subtle) {
        throw new Error("Reading .torrent files needs a secure context — use HTTPS or localhost");
    }

    try {
        const buf = new Uint8Array(await file.arrayBuffer());
        if (buf[0] !== 0x64) return null;

        const decoder = new TextDecoder();
        let i = 1;

        while (i < buf.length && buf[i] !== 0x65) {
            const keyEnd = skipValue(buf, i);
            const colon = buf.indexOf(0x3a, i);
            const key = decoder.decode(buf.subarray(colon + 1, keyEnd));
            const valueEnd = skipValue(buf, keyEnd);

            if (key === "info") {
                const digest = await crypto.subtle.digest("SHA-1", buf.subarray(keyEnd, valueEnd));
                return Array.from(new Uint8Array(digest))
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
            }
            i = valueEnd;
        }
    } catch {
        return null;
    }
    return null;
}
