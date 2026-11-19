export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 4096;

export interface ImageMeta {
  mime: 'image/webp' | 'image/png' | 'image/jpeg';
  ext: 'webp' | 'png' | 'jpg';
  width: number;
  height: number;
  size: number;
}

function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function parseWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.byteLength < 25) return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X' && buf.byteLength >= 30) {
    return {
      width: 1 + buf.readUIntLE(24, 3),
      height: 1 + buf.readUIntLE(27, 3),
    };
  }
  if (chunk === 'VP8L' && buf.byteLength >= 25 && buf[20] === 0x2f) {
    const bits = buf.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === 'VP8 ' && buf.byteLength >= 30 && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  return null;
}

function parseJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset < buf.byteLength) {
    if (buf[offset] !== 0xff) return null;
    while (offset < buf.byteLength && buf[offset] === 0xff) offset++;
    if (offset >= buf.byteLength) return null;
    const marker = buf[offset++];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (offset + 2 > buf.byteLength) return null;
    const segLen = buf.readUInt16BE(offset);
    if (segLen < 2 || offset + segLen > buf.byteLength) return null;
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof && segLen >= 7) {
      return {
        height: buf.readUInt16BE(offset + 3),
        width: buf.readUInt16BE(offset + 5),
      };
    }
    offset += segLen;
  }
  return null;
}

export function parseImageHeader(buf: Buffer): ImageMeta {
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw httpError(413, 'Image exceeds 2 MB limit');
  }
  if (buf.byteLength < 12) {
    throw httpError(415, 'Unsupported image format');
  }

  let mime: ImageMeta['mime'] | null = null;
  let ext: ImageMeta['ext'] | null = null;
  let dims: { width: number; height: number } | null = null;

  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    mime = 'image/webp';
    ext = 'webp';
    dims = parseWebpDimensions(buf);
  } else if (
    buf.byteLength >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a &&
    buf.toString('ascii', 12, 16) === 'IHDR'
  ) {
    mime = 'image/png';
    ext = 'png';
    dims = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    mime = 'image/jpeg';
    ext = 'jpg';
    dims = parseJpegDimensions(buf);
  }

  if (!mime || !ext || !dims || dims.width < 1 || dims.height < 1 || dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION) {
    throw httpError(415, 'Unsupported image format');
  }

  return {
    mime,
    ext,
    width: dims.width,
    height: dims.height,
    size: buf.byteLength,
  };
}
