import { compressSync, decompressSync, strFromU8, strToU8 } from "fflate";

export function objectToTree(obj: any) {
  return Buffer.from(
    compressSync(strToU8(JSON.stringify(obj)), { level: 6, mem: 8 }),
  ).toString("base64");
}

export const treeToObject = <T = any>(tree: string): T => {
  return JSON.parse(strFromU8(decompressSync(Buffer.from(tree, "base64"))));
};
