import { canonicalExtension, fileTypeFromBuffer } from "../src/fileType";

/**
 * @param {number[]} leading leading bytes
 * @param {number=} length how much zero padding to add
 * @returns {Buffer} a buffer starting with those bytes
 */
const bytes = (leading, length = 64) =>
  Buffer.concat([Buffer.from(leading), Buffer.alloc(length)]);

/**
 * @param {string} leading ASCII to start with
 * @param {number=} length how much zero padding to add
 * @returns {Buffer} a buffer starting with that text
 */
const text = (leading, length = 64) =>
  Buffer.concat([Buffer.from(leading, "ascii"), Buffer.alloc(length)]);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * One PNG chunk: four bytes of length, four naming it, the data, then four of
 * checksum. Built properly so a name inside a chunk's *data* is not mistaken
 * for one starting a chunk.
 * @param {string} name the chunk's name
 * @param {Buffer=} data what it carries
 * @returns {Buffer} the chunk
 */
function chunk(name, data = Buffer.alloc(0)) {
  const length = Buffer.alloc(4);

  length.writeUInt32BE(data.length);

  return Buffer.concat([
    length,
    Buffer.from(name, "ascii"),
    data,
    Buffer.alloc(4),
  ]);
}

/**
 * @param {...Buffer} chunks the chunks to carry, after the header
 * @returns {Buffer} a PNG made of them
 */
const png = (...chunks) =>
  Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    chunk("IHDR", Buffer.alloc(13)),
    ...chunks,
  ]);

describe("fileTypeFromBuffer", () => {
  it("should detect PNG", () => {
    expect(fileTypeFromBuffer(png(chunk("IDAT", Buffer.alloc(8))))).toEqual({
      ext: "png",
      mime: "image/png",
    });
  });

  it("should detect APNG by its `acTL` chunk", () => {
    expect(
      fileTypeFromBuffer(
        png(chunk("acTL", Buffer.alloc(8)), chunk("IDAT", Buffer.alloc(8))),
      ),
    ).toEqual({ ext: "apng", mime: "image/apng" });
  });

  it("should not read an `acTL` after the first `IDAT` as animation", () => {
    const late = png(chunk("IDAT", Buffer.alloc(8)), chunk("acTL"));

    expect(fileTypeFromBuffer(late).ext).toBe("png");
  });

  it("should not read a comment mentioning `acTL` as animation", () => {
    // The name means something only where a chunk starts. Scanning for it
    // instead made any image whose metadata says the word animated.
    const described = png(
      chunk("tEXt", Buffer.from("Comment: made with acTL tools")),
      chunk("IDAT", Buffer.alloc(8)),
    );

    expect(fileTypeFromBuffer(described).ext).toBe("png");
  });

  it("should not let `IDAT` inside a profile end the search early", () => {
    // The other way the same mistake reads: a real `acTL` after a profile
    // whose bytes happen to spell `IDAT` was never reached.
    const profiled = png(
      chunk("iCCP", Buffer.from("profileIDATmore")),
      chunk("acTL", Buffer.alloc(8)),
      chunk("IDAT", Buffer.alloc(8)),
    );

    expect(fileTypeFromBuffer(profiled).ext).toBe("apng");
  });

  it("should read a PNG carrying neither chunk as still", () => {
    const truncated = Buffer.concat([
      Buffer.from(PNG_SIGNATURE),
      Buffer.alloc(40),
    ]);

    expect(fileTypeFromBuffer(truncated).ext).toBe("png");
  });

  it("should stop at a chunk whose length runs past the end", () => {
    const lying = Buffer.concat([
      Buffer.from(PNG_SIGNATURE),
      chunk("IHDR", Buffer.alloc(13)),
      Buffer.from("7fffffff", "hex"),
      Buffer.from("acTL", "ascii"),
    ]);

    expect(fileTypeFromBuffer(lying).ext).toBe("apng");
  });

  it("should detect JPEG", () => {
    expect(fileTypeFromBuffer(bytes([0xff, 0xd8, 0xff]))).toEqual({
      ext: "jpg",
      mime: "image/jpeg",
    });
  });

  it("should detect GIF", () => {
    expect(fileTypeFromBuffer(text("GIF89a")).ext).toBe("gif");
  });

  it("should detect WebP", () => {
    expect(fileTypeFromBuffer(text("RIFF____WEBP")).ext).toBe("webp");
  });

  it("should not read a RIFF that is not WebP as WebP", () => {
    expect(fileTypeFromBuffer(text("RIFF____WAVE"))).toBeUndefined();
  });

  it.each([
    ["avif", "avif"],
    ["avis", "avif"],
    ["heic", "heic"],
    ["heix", "heic"],
    ["hevc", "heic"],
    ["hevx", "heic"],
    ["mif1", "heic"],
    ["msf1", "heic"],
  ])("should read the ISO brand %s as %s", (brand, ext) => {
    expect(fileTypeFromBuffer(text(`____ftyp${brand}`)).ext).toBe(ext);
  });

  it("should ignore an ISO brand that is not an image", () => {
    const video = "mp42";

    expect(fileTypeFromBuffer(text(`____ftyp${video}`))).toBeUndefined();
  });

  it("should detect a JPEG XL codestream", () => {
    expect(fileTypeFromBuffer(bytes([0xff, 0x0a])).ext).toBe("jxl");
  });

  it("should detect a JPEG XL container", () => {
    expect(
      fileTypeFromBuffer(
        bytes([
          0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87,
          0x0a,
        ]),
      ).ext,
    ).toBe("jxl");
  });

  it.each([
    ["little-endian", [0x49, 0x49, 0x2a, 0x00]],
    ["big-endian", [0x4d, 0x4d, 0x00, 0x2a]],
  ])("should detect %s TIFF", (_name, signature) => {
    expect(fileTypeFromBuffer(bytes(signature)).ext).toBe("tiff");
  });

  it("should detect BMP", () => {
    expect(fileTypeFromBuffer(text("BM")).ext).toBe("bmp");
  });

  it("should detect ICO", () => {
    expect(fileTypeFromBuffer(bytes([0x00, 0x00, 0x01, 0x00])).ext).toBe("ico");
  });

  it.each([
    [
      "a plain document",
      '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
    ],
    ["a self-closing root", "<svg/>"],
    ["nothing after the name", "<svg"],
    // XML is case-sensitive, but reading either costs nothing.
    ["an upper-case root", "<SVG></SVG>"],
    ["leading whitespace", "\n\n   <svg></svg>"],
    ["an XML prolog", '<?xml version="1.0"?><svg></svg>'],
    [
      "a prolog and a doctype",
      '<?xml version="1.0"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN">\n<svg></svg>',
    ],
    ["a comment first", "<!-- by hand -->\n<svg></svg>"],
    ["several comments", "<!--a--><!--b--><svg></svg>"],
  ])("should detect SVG past %s", (_name, markup) => {
    expect(fileTypeFromBuffer(Buffer.from(markup))).toEqual({
      ext: "svg",
      mime: "image/svg+xml",
    });
  });

  it("should detect SVG past a byte-order mark", () => {
    expect(
      fileTypeFromBuffer(
        Buffer.concat([
          Buffer.from([0xef, 0xbb, 0xbf]),
          Buffer.from("<svg></svg>"),
        ]),
      ).ext,
    ).toBe("svg");
  });

  it.each([
    // The root element is asked for, so an inline one does not count.
    [
      "an HTML page carrying an inline one",
      "<!DOCTYPE html><html><svg/></html>",
    ],
    ["an HTML page with no doctype", "<html><svg/></html>"],
    ["another kind of XML", '<?xml version="1.0"?><rss></rss>'],
    ["prose mentioning one", "this file talks about <svg> tags"],
    ["an element whose name merely starts with it", "<svg-icon></svg-icon>"],
  ])("should not read %s as SVG", (_name, markup) => {
    expect(fileTypeFromBuffer(Buffer.from(markup))).toBeUndefined();
  });

  it("should give up rather than walk a document that never opens", () => {
    // The scan is bounded, so an unterminated comment ends it.
    const runaway = Buffer.concat([
      Buffer.from("<!--"),
      Buffer.alloc(4000, 0x61),
    ]);

    expect(fileTypeFromBuffer(runaway)).toBeUndefined();
  });

  it("should not read a gzipped SVG as one, having no markup to read", () => {
    expect(
      fileTypeFromBuffer(Buffer.from([0x1f, 0x8b, 0x08, 0x00])),
    ).toBeUndefined();
  });

  it.each([
    [
      "the container",
      [0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a],
    ],
    ["a bare codestream", [0xff, 0x4f, 0xff, 0x51]],
  ])("should detect JPEG 2000 as %s", (_name, signature) => {
    expect(fileTypeFromBuffer(bytes(signature))).toEqual({
      ext: "jp2",
      mime: "image/jp2",
    });
  });

  it("should keep JPEG XL's container apart from JPEG 2000's", () => {
    // The same box structure; only the four bytes naming it differ.
    expect(
      fileTypeFromBuffer(
        bytes([
          0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87,
          0x0a,
        ]),
      ).ext,
    ).toBe("jxl");
  });

  it("should name nothing for an unknown format", () => {
    expect(fileTypeFromBuffer(bytes([0x01, 0x02, 0x03, 0x04]))).toBeUndefined();
  });

  it("should name nothing for a buffer too short to hold a signature", () => {
    expect(fileTypeFromBuffer(Buffer.from([0x89]))).toBeUndefined();
  });

  it("should accept a Uint8Array and an ArrayBuffer", () => {
    const buffer = bytes([0xff, 0xd8, 0xff]);

    expect(fileTypeFromBuffer(new Uint8Array(buffer)).ext).toBe("jpg");
    expect(
      fileTypeFromBuffer(
        buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ),
      ).ext,
    ).toBe("jpg");
  });

  it("should throw on anything else", () => {
    expect(() => fileTypeFromBuffer("not a buffer")).toThrow(
      /Expected the `input` argument to be of type/,
    );
  });
});

describe("canonicalExtension", () => {
  it.each([
    ["jpeg", "jpg"],
    ["tif", "tiff"],
    ["apng", "png"],
    ["heif", "heic"],
    ["j2k", "jp2"],
    ["j2c", "jp2"],
    ["jpx", "jp2"],
  ])("should read %s as %s", (from, to) => {
    expect(canonicalExtension(from)).toBe(to);
  });

  it("should leave an extension it does not alias alone", () => {
    expect(canonicalExtension("webp")).toBe("webp");
  });
});
