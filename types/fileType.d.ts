export type Uint8ArrayUtf8ByteString = (
  array: number[] | Uint8Array,
  start: number,
  end: number,
) => string;
export type StringToBytes = (string: string) => number[];
/**
 * @param {ArrayBuffer | ArrayLike<number>} input input buffer
 * @returns {{ ext: string, mime: string } | undefined} file type info
 */
export function fileTypeFromBuffer(input: ArrayBuffer | ArrayLike<number>):
  | {
      ext: string;
      mime: string;
    }
  | undefined;
