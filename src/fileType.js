/**
 * Which image format a buffer holds, read off its leading bytes.
 *
 * Only what an image minimizer can be handed or can write: `imageminMinify`
 * compares an asset's extension against the format its plugins produced, so a
 * format no such plugin emits could never change the answer. An unrecognized
 * buffer names nothing, which is also how a format with no signature at all —
 * SVG — reads.
 */

/**
 * Extensions that name the same format. Both sides of the comparison are read
 * through this, so `image.jpeg` holding a JPEG is not a mismatch.
 * @type {Map<string, string>}
 */
const CANONICAL_EXTENSION = new Map([
  ["apng", "png"],
  ["heif", "heic"],
  ["jpeg", "jpg"],
  ["tif", "tiff"],
]);

/**
 * @param {string} extension an extension, without the dot
 * @returns {string} the extension every spelling of that format is read as
 */
function canonicalExtension(extension) {
  return CANONICAL_EXTENSION.get(extension) || extension;
}

/**
 * The brands an ISO base media file names that are still an image, by the
 * extension each is written with.
 * @type {Map<string, string>}
 */
const ISO_BRANDS = new Map([
  ["avif", "avif"],
  ["avis", "avif"],
  ["heic", "heic"],
  ["heix", "heic"],
  ["hevc", "heic"],
  ["hevx", "heic"],
  ["mif1", "heic"],
  ["msf1", "heic"],
]);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// Past the signature and the IHDR chunk, where an `acTL` may precede the first
// `IDAT` — which is what makes a PNG an APNG.
const PNG_CHUNKS_START = 33;

/**
 * @param {Uint8Array} buffer the bytes
 * @param {number[]} signature the bytes to match
 * @param {number=} offset where to match them
 * @returns {boolean} true when they are there
 */
function startsWith(buffer, signature, offset = 0) {
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i + offset] !== signature[i]) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Uint8Array} buffer the bytes
 * @param {string} text the ASCII to match
 * @param {number=} offset where to match it
 * @returns {boolean} true when it is there
 */
function hasText(buffer, text, offset = 0) {
  for (let i = 0; i < text.length; i++) {
    if (buffer[i + offset] !== text.charCodeAt(i)) {
      return false;
    }
  }

  return true;
}

/**
 * Whether a PNG carries an `acTL` chunk before its first `IDAT`, which makes it
 * an animated one.
 * @param {Uint8Array} buffer the bytes
 * @returns {boolean} true when it is animated
 */
function isAnimatedPng(buffer) {
  for (let i = PNG_CHUNKS_START; i < buffer.length - 4; i++) {
    if (hasText(buffer, "IDAT", i)) {
      return false;
    }

    if (hasText(buffer, "acTL", i)) {
      return true;
    }
  }

  return false;
}

/**
 * @param {ArrayBuffer | ArrayLike<number>} input the bytes
 * @returns {{ ext: string, mime: string } | undefined} the format, or undefined when it names none
 */
function fileTypeFromBuffer(input) {
  if (!(
    input instanceof Uint8Array ||
    input instanceof ArrayBuffer ||
    Buffer.isBuffer(input)
  )) {
    throw new TypeError(
      `Expected the \`input\` argument to be of type \`Uint8Array\` or \`Buffer\` or \`ArrayBuffer\`, got \`${typeof input}\``,
    );
  }

  const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (buffer.length < 2) {
    return undefined;
  }

  if (startsWith(buffer, PNG_SIGNATURE)) {
    return isAnimatedPng(buffer)
      ? { ext: "apng", mime: "image/apng" }
      : { ext: "png", mime: "image/png" };
  }

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { ext: "jpg", mime: "image/jpeg" };
  }

  if (hasText(buffer, "GIF")) {
    return { ext: "gif", mime: "image/gif" };
  }

  if (hasText(buffer, "RIFF") && hasText(buffer, "WEBP", 8)) {
    return { ext: "webp", mime: "image/webp" };
  }

  if (hasText(buffer, "ftyp", 4)) {
    const brand = ISO_BRANDS.get(
      String.fromCharCode(...buffer.subarray(8, 12)),
    );

    if (brand) {
      return { ext: brand, mime: `image/${brand}` };
    }
  }

  // The raw codestream, and the container that can hold one.
  if (
    startsWith(buffer, [0xff, 0x0a]) ||
    startsWith(
      buffer,
      [0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a],
    )
  ) {
    return { ext: "jxl", mime: "image/jxl" };
  }

  if (
    startsWith(buffer, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    return { ext: "tiff", mime: "image/tiff" };
  }

  if (hasText(buffer, "BM")) {
    return { ext: "bmp", mime: "image/bmp" };
  }

  if (startsWith(buffer, [0x00, 0x00, 0x01, 0x00])) {
    return { ext: "ico", mime: "image/x-icon" };
  }

  return undefined;
}

module.exports = { canonicalExtension, fileTypeFromBuffer };
