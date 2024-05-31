/**
 * Credit goes to https://github.com/juanelas/object-sha
 *
 * @remarks
 * This module runs perfectly in node.js and browsers
 *
 * @packageDocumentation
 */

import { isBrowser } from "./utils.js";

/**
 * Returns a string with a hexadecimal representation of the digest of the input object using a given hash algorithm.
 * It first creates an array of the object values ordered by the object keys (using hashable(obj));
 * then, it JSON.stringify-es it; and finally it hashes it.
 *
 * @param obj - An Object
 * @param algorithm - For compatibility with browsers it should be 'SHA-1', 'SHA-256', 'SHA-384' and 'SHA-512'.
 *
 * @param isBrowser
 * @throws {RangeError}
 * Thrown if an invalid hash algorithm is selected.
 *
 * @returns a promise that resolves to a string with hexadecimal content.
 */
export function digest(obj: any, algorithm = "SHA-256"): Promise<string> {
  // eslint-disable-line
  const algorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
  if (!algorithms.includes(algorithm)) {
    throw RangeError(
      `Valid hash algorithm values are any of ${JSON.stringify(algorithms)}`,
    );
  }
  return (async function (obj, algorithm) {
    const encoder = new TextEncoder();
    const hashInput = encoder.encode(hashable(obj)).buffer;
    let digest = "";

    if (isBrowser()) {
      const buf = await crypto.subtle.digest(algorithm, hashInput);
      const h = "0123456789abcdef";
      for (const v of new Uint8Array(buf)) {
        digest += h[v >> 4] + h[v & 15];
      }
    } else {
      const nodeAlg = algorithm.toLowerCase().replace("-", "");
      digest = (await import("crypto"))
        .createHash(nodeAlg)
        .update(Buffer.from(hashInput))
        .digest("hex"); // eslint-disable-line
    }
    /* eslint-enable no-lone-blocks */
    return digest;
  })(obj, algorithm);
}

function isObject(val: any): boolean {
  return val != null && typeof val === "object" && !Array.isArray(val);
}

function objectToArraySortedByKey(obj: any): any {
  if (!isObject(obj) && !Array.isArray(obj)) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => {
      if (Array.isArray(item) || isObject(item)) {
        return objectToArraySortedByKey(item);
      }
      return item;
    });
  }
  // if it is an object convert to array and sort
  return Object.keys(obj) // eslint-disable-line
    .sort()
    .map((key) => {
      return [key, objectToArraySortedByKey(obj[key])];
    });
}

/**
 * If the input object is not an Array, this function converts the object to an array, all the key-values to 2-arrays [key, value] and then sort the array by the keys. All the process is done recursively so objects inside objects or arrays are also ordered. Once the array is created the method returns the JSON.stringify() of the sorted array.
 *
 * @param {object} obj the object
 *
 * @returns {string} a JSON stringify of the created sorted array
 */
const hashable = (obj: object) => {
  return JSON.stringify(objectToArraySortedByKey(obj));
};
