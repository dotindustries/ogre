import { compressSync, decompressSync, strFromU8, strToU8 } from "fflate";

export function objectToTree(obj: any, serializeFn?: (obj: any) => string) {
  const serialized = serializeFn ? serializeFn(obj) : JSON.stringify(obj);
  return Buffer.from(
    compressSync(strToU8(serialized), { level: 6, mem: 8 }),
  ).toString("base64");
}

export const treeToObject = <T = any>(tree: string, deserializeFn?: (str: string) => T): T => {
  const fn = deserializeFn ?? JSON.parse;
  return fn(strFromU8(decompressSync(Buffer.from(tree, "base64"))));
};
