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
 * @param {string} chunk the chunk name to place where `acTL` would sit
 * @returns {Buffer} a PNG carrying it
 */
const png = (chunk) =>
  Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    Buffer.alloc(25),
    Buffer.from(chunk, "ascii"),
    Buffer.alloc(16),
  ]);

describe("fileTypeFromBuffer", () => {
  it("should detect PNG", () => {
    expect(fileTypeFromBuffer(png("IDAT"))).toEqual({
      ext: "png",
      mime: "image/png",
    });
  });

  it("should detect APNG by its `acTL` chunk", () => {
    expect(fileTypeFromBuffer(png("acTL"))).toEqual({
      ext: "apng",
      mime: "image/apng",
    });
  });

  it("should not read an `acTL` after the first `IDAT` as animation", () => {
    const late = Buffer.concat([png("IDAT"), Buffer.from("acTL", "ascii")]);

    expect(fileTypeFromBuffer(late).ext).toBe("png");
  });

  it("should read a PNG carrying neither chunk as still", () => {
    const truncated = Buffer.concat([
      Buffer.from(PNG_SIGNATURE),
      Buffer.alloc(40),
    ]);

    expect(fileTypeFromBuffer(truncated).ext).toBe("png");
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

  it("should name nothing for SVG, which has no signature", () => {
    expect(fileTypeFromBuffer(Buffer.from("<svg></svg>"))).toBeUndefined();
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
  ])("should read %s as %s", (from, to) => {
    expect(canonicalExtension(from)).toBe(to);
  });

  it("should leave an extension it does not alias alone", () => {
    expect(canonicalExtension("webp")).toBe("webp");
  });
});
