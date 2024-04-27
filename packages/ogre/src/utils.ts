// [RFC5322](https://www.ietf.org/rfc/rfc5322.txt)
import { Commit } from "./commit.js";
import { Reference } from "./interfaces.js";
import { decompressSync, strFromU8 } from "fflate";
import { validBranch, validRef } from "./ref.js";
import { deepClone, Operation } from "fast-json-patch/index.mjs";
import { RepositoryObject } from "./repository.js";

const emailRegex =
  /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

export const cleanAuthor = (author: string): [name: string, email: string] => {
  if (author === "") {
    throw new Error(`author not provided`);
  }
  // author name <email>
  let strings = author.split(" <");
  if (strings.length > 1) {
    return [strings[0], strings[1].replace(">", "")];
  }
  // author name @handle
  strings = author.split(" @");
  if (strings.length > 1) {
    return [strings[0], `@${strings[1]}`];
  }
  // email@domain.com
  if (emailRegex.test(author)) {
    return ["", author];
  }
  // unrecognized format
  return [author, ""];
};

export const localRefPrefix = `refs/`;
export const remoteRefPrefix = `refs/remotes/origin/`;
export const tagRefPathPrefix = "tags/";
export const headsRefPathPrefix = "heads/";
export const headValueRefPrefix = "ref: ";
export const localHeadPathPrefix = () =>
  `${localRefPrefix}${headsRefPathPrefix}`;
export const remoteHeadPathPrefix = () =>
  `${remoteRefPrefix}${headsRefPathPrefix}`;
export const localTagPathPrefix = () => `${localRefPrefix}${tagRefPathPrefix}`;
export const remoteTagPathPrefix = () =>
  `${remoteRefPrefix}${tagRefPathPrefix}`;
export const REFS_HEAD_KEY = "HEAD";
/**
 * Should only be used in local context
 */
export const REFS_MAIN_KEY = `${localHeadPathPrefix()}main`;
export const treeToObject = <T = any>(tree: string): T => {
  return JSON.parse(strFromU8(decompressSync(Buffer.from(tree, "base64"))));
};

/**
 * Maps the path from a commit to another commit.
 * It travels backwards through parent relationships until the root state.
 * It returns a boolean whether the to commit parameter is a direct ancestor
 * of the from commit and returns the path of commits between them.
 *
 * @param commits
 * @param from the higher commit to start from
 * @param to to lower commit to arrive at
 */
export const mapPath = (
  commits: Array<Commit>,
  from: Commit,
  to?: Commit,
): [isAncestor: boolean, path: Array<Commit>] => {
  // early exit for first commit
  if (from.parent === undefined && to === undefined) return [true, [from]];

  const path: Array<Commit> = [];
  let parent: Commit | undefined = from;
  while (parent !== undefined) {
    const child = parent;
    parent = commits.find((gp) => gp.hash === parent?.parent);
    const atTarget = parent?.hash === to?.hash;

    path.push(child);

    if (atTarget) {
      if (parent) path.push(parent);
      return [true, path];
    }
  }
  return [false, []];
};
/**
 * Returns the commit to which the provided ref is pointing
 * @param ref - needs to be in key format, e.g. refs/heads/... or refs/tags/...
 * @param references
 * @param commitsList
 */
export const commitAtRefIn = (
  ref: string,
  references: Map<string, Reference>,
  commitsList: Commit[],
) => {
  const reference = references.get(ref);
  if (!reference) {
    throw new Error(`unreachable: '${ref}' is not present`);
  }
  let commitHash;
  if (reference.value.includes(headValueRefPrefix)) {
    const refKey = cleanRefValue(reference.value);
    const targetRef = references.get(refKey);
    if (!targetRef) {
      // target branch may not have been saved yet
      return undefined;
    }
    commitHash = targetRef.value;
  } else {
    commitHash = reference.value;
  }
  for (const c of commitsList) {
    if (c.hash === commitHash) {
      return c;
    }
  }
  return undefined;
};
export const refsAtCommit = (
  references: Map<string, Reference>,
  commit: Commit,
) => {
  const list: Array<Reference> = [];
  for (const [name, ref] of references.entries()) {
    if (ref.value === commit.hash) {
      list.push(ref);
    }
  }
  return list;
};
/**
 * Accepts a shaish expression (e.g. refs (branches, tags), commitSha) and returns
 * - a commit of type Commit
 * - isRef boolean whether it is a direct reference
 * - ref the key of the reference
 */
export const shaishToCommit = (
  shaish: string,
  references: Map<string, Reference>,
  commitsList: Commit[],
): [commit: Commit, isRef: boolean, ref: string | undefined] => {
  let sha = shaish;
  let isRef = false;
  let refKey: string | undefined = undefined;

  // check for refs
  for (const [name, ref] of references.entries()) {
    // match on
    if (ref.name === shaish || name === shaish) {
      isRef = true;
      refKey = name;
      sha = ref.value;
      if (sha.includes(headValueRefPrefix)) {
        const cleanedRef = cleanRefValue(sha);
        const c = commitAtRefIn(cleanedRef, references, commitsList);
        if (!c) {
          throw new Error(`${cleanedRef} points to non-existing commit`);
        }
        return [c, isRef, refKey];
      }
      break;
    }
  }
  // check for partial sha matches
  const found = commitsList.filter((c) => c.hash.indexOf(sha) > -1);
  if (found.length === 0) {
    throw new Error(`pathspec '${shaish}' did not match any known refs`);
  }
  // but sha should be specific enough to resolve to 1 commit
  if (found.length > 1) {
    throw new Error(`commit `);
  }
  return [found[0], isRef, refKey];
};
export const createHeadRefValue = (refKey: string) => {
  return `${headValueRefPrefix}${refKey}`;
};
export const isTagRef = (refKey: string) =>
  refKey.indexOf(localTagPathPrefix()) > -1;
export const cleanRefValue = (ref: string) =>
  ref.replace(headValueRefPrefix, "");
export const brancheNameToRef = (name: string) => {
  return `${localHeadPathPrefix()}${name}`;
};
export const tagToRef = (tag: string) => {
  return `${localTagPathPrefix()}${tag}`;
};
export const validateBranchName = (name: string) => {
  if (!validBranch(name)) {
    throw new Error(`invalid ref name`);
  }
};
export const validateRef = (name: string, oneLevel: boolean = true) => {
  if (!validRef(name, oneLevel)) {
    throw new Error(`invalid ref name`);
  }
};
/**
 * Prints the underlying changelog of a repository
 * @param repository
 */
export const printChangeLog = <T extends { [k: string]: any }>(
  repository: RepositoryObject<T>,
) => {
  console.log("----------------------------------------------------------");
  console.log("Changelog");
  console.log("----------------------------------------------------------");
  const history = repository.getHistory();
  const head = commitAtRefIn(repository.head(), history.refs, history.commits);
  if (!head) {
    throw new Error(`fatal: HEAD is not defined`);
  }
  let c: Commit | undefined = head;
  while (c) {
    console.log(
      `${c.hash} ${refsAtCommit(history.refs, c)
        .map((r) => r.name)
        .join(" ")}`,
    );
    for (const chg of c.changes) {
      printChange(chg);
    }
    c = history.commits.find((parent) => parent.hash === c?.parent);
  }
  console.log("End of changelog");
  console.log("----------------------------------------------------------");
};
export const printChange = (chg: Operation) => {
  console.log(`  ${JSON.stringify(chg)}`);
};
/**
 * Should be called with a `/` delimited ref path. E.g. refs/heads/main
 * @param thePath
 */
export const getLastRefPathElement = (thePath: string) =>
  thePath.substring(thePath.lastIndexOf("/") + 1);

export const immutableMapCopy = <T extends object>(
  map: Map<string, T> | undefined,
) => {
  if (!map) {
    return undefined;
  }
  const m = new Map<string, Readonly<T>>();
  for (const [key, value] of map) {
    m.set(key, { ...value });
  }
  return m as ReadonlyMap<string, Readonly<T>>;
};

export const mutableMapCopy = <T extends object>(map: Map<string, T>) => {
  const m = new Map<string, T>();
  for (const [key, value] of map) {
    m.set(key, { ...value });
  }
  return m;
};

export const immutableArrayCopy = <T, R extends any>(
  arr: Array<T> | undefined,
  fn: (obj: T) => Readonly<R> = (o) =>
    typeof o === "object" ? deepClone(o) : o,
) => {
  if (!arr) {
    return undefined;
  }
  const a: Array<Readonly<R>> = [];
  for (let i = 0; i < arr.length; i++) {
    const o = arr[i];
    a.push(fn(o));
  }

  return a as ReadonlyArray<Readonly<R>>;
};
