/**
 * @param {string} extension an extension, without the dot
 * @returns {string} the extension every spelling of that format is read as
 */
export function canonicalExtension(extension: string): string;
/**
 * @param {ArrayBuffer | ArrayLike<number>} input the bytes
 * @returns {{ ext: string, mime: string } | undefined} the format, or undefined when it names none
 */
export function fileTypeFromBuffer(input: ArrayBuffer | ArrayLike<number>):
  | {
      ext: string;
      mime: string;
    }
  | undefined;
