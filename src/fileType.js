/**
 * Which image format a buffer holds, read off its leading bytes.
 *
 * Ported from `image-minimizer-webpack-plugin`, where it guards against a
 * minifier silently writing one format into another format's file name.
 */

/**
 * @callback Uint8ArrayUtf8ByteString
 * @param {number[] | Uint8Array} array
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */

/** @type {Uint8ArrayUtf8ByteString} */
const uint8ArrayUtf8ByteString = (array, start, end) =>
  String.fromCodePoint(...array.slice(start, end));

/**
 * @callback StringToBytes
 * @param {string} string
 * @returns {number[]}
 */

/** @type {StringToBytes} */
const stringToBytes = (string) =>
  [...string].map((character) => character.charCodeAt(0));

/**
 * @param {ArrayBuffer | ArrayLike<number>} input input buffer
 * @returns {{ ext: string, mime: string } | undefined} file type info
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

  if (!(buffer && buffer.length > 1)) {
    return;
  }

  /**
   * @param {number[]} header header bytes
   * @param {{ offset: number, mask?: number[] }=} options options
   * @returns {boolean} whether the header matches
   */
  const check = (header, options) => {
    options = {
      offset: 0,
      ...options,
    };

    for (let i = 0; i < header.length; i++) {
      if (options.mask) {
        if (header[i] !== (options.mask[i] & buffer[i + options.offset])) {
          return false;
        }
      } else if (header[i] !== buffer[i + options.offset]) {
        return false;
      }
    }

    return true;
  };

  /**
   * @param {string} header header string
   * @param {{ offset: number, mask?: number[] }=} options options
   * @returns {boolean} whether the header matches
   */
  const checkString = (header, options) =>
    check(stringToBytes(header), options);

  if (check([0xff, 0xd8, 0xff])) {
    return {
      ext: "jpg",
      mime: "image/jpeg",
    };
  }

  if (check([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    // APNG format (https://wiki.mozilla.org/APNG_Specification)
    // 1. Find the first IDAT (image data) chunk (49 44 41 54)
    // 2. Check if there is an "acTL" chunk before the IDAT one (61 63 54 4C)

    // Offset calculated as follows:
    // - 8 bytes: PNG signature
    // - 4 (length) + 4 (chunk type) + 13 (chunk data) + 4 (CRC): IHDR chunk
    const startIndex = 33;
    const firstImageDataChunkIndex = buffer.findIndex(
      (el, i) =>
        i >= startIndex &&
        buffer[i] === 0x49 &&
        buffer[i + 1] === 0x44 &&
        buffer[i + 2] === 0x41 &&
        buffer[i + 3] === 0x54,
    );
    const sliced = buffer.subarray(startIndex, firstImageDataChunkIndex);

    if (
      sliced.some(
        (el, i) =>
          sliced[i] === 0x61 &&
          sliced[i + 1] === 0x63 &&
          sliced[i + 2] === 0x54 &&
          sliced[i + 3] === 0x4c,
      )
    ) {
      return {
        ext: "apng",
        mime: "image/apng",
      };
    }

    return {
      ext: "png",
      mime: "image/png",
    };
  }

  if (check([0x47, 0x49, 0x46])) {
    return {
      ext: "gif",
      mime: "image/gif",
    };
  }

  if (check([0x57, 0x45, 0x42, 0x50], { offset: 8 })) {
    return {
      ext: "webp",
      mime: "image/webp",
    };
  }

  if (check([0x46, 0x4c, 0x49, 0x46])) {
    return {
      ext: "flif",
      mime: "image/flif",
    };
  }

  // `cr2`, `orf`, and `arw` need to be before `tif` check
  if (
    (check([0x49, 0x49, 0x2a, 0x0]) || check([0x4d, 0x4d, 0x0, 0x2a])) &&
    check([0x43, 0x52], { offset: 8 })
  ) {
    return {
      ext: "cr2",
      mime: "image/x-canon-cr2",
    };
  }

  if (check([0x49, 0x49, 0x52, 0x4f, 0x08, 0x00, 0x00, 0x00, 0x18])) {
    return {
      ext: "orf",
      mime: "image/x-olympus-orf",
    };
  }

  if (
    check([0x49, 0x49, 0x2a, 0x00]) &&
    (check([0x10, 0xfb, 0x86, 0x01], { offset: 4 }) ||
      check([0x08, 0x00, 0x00, 0x00], { offset: 4 })) &&
    // This pattern differentiates ARW from other TIFF-ish file types:
    check(
      [
        0x00, 0xfe, 0x00, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
        0x00, 0x03, 0x01,
      ],
      { offset: 9 },
    )
  ) {
    return {
      ext: "arw",
      mime: "image/x-sony-arw",
    };
  }

  if (
    check([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]) &&
    (check([0x2d, 0x00, 0xfe, 0x00], { offset: 8 }) ||
      check([0x27, 0x00, 0xfe, 0x00], { offset: 8 }))
  ) {
    return {
      ext: "dng",
      mime: "image/x-adobe-dng",
    };
  }

  if (
    check([0x49, 0x49, 0x2a, 0x00]) &&
    check([0x1c, 0x00, 0xfe, 0x00], { offset: 8 })
  ) {
    return {
      ext: "nef",
      mime: "image/x-nikon-nef",
    };
  }

  if (
    check([
      0x49, 0x49, 0x55, 0x00, 0x18, 0x00, 0x00, 0x00, 0x88, 0xe7, 0x74, 0xd8,
    ])
  ) {
    return {
      ext: "rw2",
      mime: "image/x-panasonic-rw2",
    };
  }

  // `raf` is here just to keep all the raw image detectors together.
  if (checkString("FUJIFILMCCD-RAW")) {
    return {
      ext: "raf",
      mime: "image/x-fujifilm-raf",
    };
  }

  if (check([0x49, 0x49, 0x2a, 0x0]) || check([0x4d, 0x4d, 0x0, 0x2a])) {
    return {
      ext: "tif",
      mime: "image/tiff",
    };
  }

  if (check([0x42, 0x4d])) {
    return {
      ext: "bmp",
      mime: "image/bmp",
    };
  }

  if (check([0x49, 0x49, 0xbc])) {
    return {
      ext: "jxr",
      mime: "image/vnd.ms-photo",
    };
  }

  if (check([0x38, 0x42, 0x50, 0x53])) {
    return {
      ext: "psd",
      mime: "image/vnd.adobe.photoshop",
    };
  }

  if (
    checkString("ftyp", { offset: 4 }) &&
    (buffer[8] & 0x60) !== 0x00 // Brand major, first character ASCII?
  ) {
    // They all can have MIME `video/mp4` except `application/mp4` special-case which is hard to detect.
    // For some cases, we're specific, everything else falls to `video/mp4` with `mp4` extension.
    const brandMajor = uint8ArrayUtf8ByteString(buffer, 8, 12)
      .replace("\0", " ")
      .trim();

    switch (brandMajor) {
      case "avif":
        return { ext: "avif", mime: "image/avif" };
      case "mif1":
        return { ext: "heic", mime: "image/heif" };
      case "msf1":
        return { ext: "heic", mime: "image/heif-sequence" };
      case "heic":
      case "heix":
        return { ext: "heic", mime: "image/heic" };
      case "hevc":
      case "hevx":
        return { ext: "heic", mime: "image/heic-sequence" };
    }
  }

  if (check([0x00, 0x00, 0x01, 0x00])) {
    return {
      ext: "ico",
      mime: "image/x-icon",
    };
  }

  if (check([0x00, 0x00, 0x02, 0x00])) {
    return {
      ext: "cur",
      mime: "image/x-icon",
    };
  }

  if (check([0x42, 0x50, 0x47, 0xfb])) {
    return {
      ext: "bpg",
      mime: "image/bpg",
    };
  }

  if (
    check([
      0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
    ])
  ) {
    // JPEG-2000 family

    if (check([0x6a, 0x70, 0x32, 0x20], { offset: 20 })) {
      return {
        ext: "jp2",
        mime: "image/jp2",
      };
    }

    if (check([0x6a, 0x70, 0x78, 0x20], { offset: 20 })) {
      return {
        ext: "jpx",
        mime: "image/jpx",
      };
    }

    if (check([0x6a, 0x70, 0x6d, 0x20], { offset: 20 })) {
      return {
        ext: "jpm",
        mime: "image/jpm",
      };
    }

    if (check([0x6d, 0x6a, 0x70, 0x32], { offset: 20 })) {
      return {
        ext: "mj2",
        mime: "image/mj2",
      };
    }
  }

  if (
    check([0xff, 0x0a]) ||
    check([
      0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
    ])
  ) {
    return {
      ext: "jxl",
      mime: "image/jxl",
    };
  }

  if (
    check([
      0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
  ) {
    return {
      ext: "ktx",
      mime: "image/ktx",
    };
  }
}

module.exports = { fileTypeFromBuffer };
