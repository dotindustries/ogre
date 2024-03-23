import {
  observe,
  unobserve,
  compare,
  applyReducer,
  deepClone,
  generate,
  Observer,
  Operation,
  validate,
  applyPatch,
  JsonPatchError,
} from "fast-json-patch";
import { calculateCommitHash, Commit } from "./commit";
import { History, Reference } from "./interfaces";
import { validBranch, validRef } from "./ref";
import { compressSync, decompressSync, strFromU8, strToU8 } from "fflate";

const tagRefPathPrefix = "refs/tags/";
const headsRefPathPrefix = "refs/heads/";
const headValueRefPrefix = "ref: ";

export const REFS_HEAD_KEY = "HEAD";
export const REFS_MAIN_KEY = `${headsRefPathPrefix}main`;

export interface RepositoryOptions<T extends { [k: string]: any }> {
  history?: History;
}

export interface RepositoryObject<T extends { [k: string]: any }> {
  data: T;

  getHistory(): History;

  /**
   * Returns the diff between the current HEAD and provided shaish expression
   *
   * @param shaishFrom expression (e.g. refs (branches, tags), commitSha)
   * @param shaishTo expression (e.g. refs (branches, tags), commitSha)
   */
  diff(shaishFrom: string, shaishTo?: string): Operation[];

  /**
   * Returns pending changes.
   */
  status(): Operation[];

  /**
   * Applies a patch to the repository's HEAD
   * @param patch
   */
  apply(patch: Operation[]): void;

  // It returns the reference where we are currently at
  head(): string;

  // Returns the commit hash to which a reference points
  ref(reference: string): string | undefined;

  commit(message: string, author: string, amend?: boolean): Promise<string>;

  checkout(shaish: string, createBranch?: boolean): void;

  logs(commits?: number): Commit[];

  createBranch(name: string): string;

  merge(source: string | RepositoryObject<T> | History): string;

  /**
   * Branch returns the current branch name
   */
  branch(): string;

  tag(tag: string): string;

  /**
   * Moves the HEAD and the branch to a specific shaish (commit or tag)
   * @param mode hard - discard changes
   * @param shaish
   */
  reset(mode?: "soft" | "hard", shaish?: string): void;

  /**
   * Returns the remote references from the initialization of the repository
   */
  remote(): Map<string, Reference> | undefined;
}

/**
 * A repository recording and managing the state transitions of an object
 */
export class Repository<T extends { [k: PropertyKey]: any }>
  implements RepositoryObject<T>
{
  constructor(obj: Partial<T>, options: RepositoryOptions<T>) {
    // FIXME: move this to refs/remote as git would do?
    this.remoteRefs = options.history?.refs;
    this.original = deepClone(obj);
    // store js ref, so obj can still be modified without going through repo.data
    this.data = obj as T;
    this.observer = observe(obj as T);
    this.refs =
      options.history?.refs ??
      new Map<string, Reference>([
        [
          REFS_HEAD_KEY,
          {
            name: REFS_HEAD_KEY,
            value: `ref: ${REFS_MAIN_KEY}`,
          },
        ],
      ]);

    this.commits = options.history?.commits ?? [];

    if (options.history) {
      const commit = this.commitAtHead();
      if (!commit) {
        return;
      }
      this.moveTo(commit);
    }
  }

  private readonly original: T;

  data: T;

  // stores the remote state upon initialization
  private readonly remoteRefs: Map<string, Reference> | undefined;

  private observer: Observer<T>;

  private readonly refs: Map<string, Reference>;
  private readonly commits: Commit[];

  remote(): Map<string, Reference> | undefined {
    return this.remoteRefs;
  }

  private moveTo(commit: Commit) {
    const targetTree = treeToObject(commit.tree);
    const patchToTarget = compare(this.data, targetTree);
    if (!patchToTarget || patchToTarget.length < 1) {
      return;
    }
    this.observer.unobserve();
    patchToTarget.reduce(applyReducer, this.data);
    this.observer = observe(this.data);
  }

  apply(patch: Operation[]): JsonPatchError | undefined {
    const p = deepClone(patch) as Operation[];
    const err = validate(p, this.data);
    if (err) {
      // credit goes to @NicBright
      // https://github.com/Starcounter-Jack/JSON-Patch/issues/280#issuecomment-1980435509
      if (err.name === "OPERATION_PATH_UNRESOLVABLE") {
        if (err.operation.op === "replace") {
          // can happen e.g. when states are like this:
          // from.x = undefined
          // to.x = 'something'
          const op = p.find(
            (o) => o.path === err.operation.path && o.op === err.operation.op,
          );
          if (!op) return err;
          // try it once more with operation 'add' instead
          op.op = "add";
          return this.apply(p);
        } else if (err.operation.op === "remove") {
          // Can happen e.g. when states are like this:
          // from.entity.reason = null;
          // to.entity.reason = undefined;
          // we don't do anything in this case because "to" is already in a good state!
        }
      } else {
        return err;
      }
    }
    applyPatch(this.data, patch);
    // const changed = patch.reduce(applyReducer, this.data);
  }

  reset(
    mode: "soft" | "hard" | undefined = "hard",
    shaish: string | undefined = REFS_HEAD_KEY,
  ): void {
    if (mode === "hard") {
      unobserve(this.data, this.observer);
    }

    const [commit] = shaishToCommit(shaish, this.refs, this.commits);
    this.moveTo(commit);

    const refs = refsAtCommit(this.refs, commit);
    // reset only moves heads and not tags
    const moveableRefs = refs.filter((r) =>
      r.name.startsWith(headsRefPathPrefix),
    );

    for (const ref of moveableRefs) {
      this.moveRef(ref.name, commit);
    }

    if (mode === "hard") {
      this.observer = observe(this.data);
    }
  }

  branch(): string {
    const currentHeadRef = this.refs.get(REFS_HEAD_KEY);
    if (!currentHeadRef) {
      throw new Error("unreachable: ref HEAD not available");
    }

    if (currentHeadRef.value.includes(headValueRefPrefix)) {
      const refName = cleanRefValue(currentHeadRef.value);
      if (this.refs.has(refName)) return getLastItem(refName);
    }

    return REFS_HEAD_KEY; // detached state
  }

  status() {
    const commit = this.commitAtHead();
    if (!commit) {
      // on root repo return the pending changes
      return compare(this.original, this.data); // this.observer.patches is empty?? :(
    }
    return this.diff(commit.hash);
  }

  diff(shaishFrom: string, shaishTo?: string): Operation[] {
    const [cFrom] = shaishToCommit(shaishFrom, this.refs, this.commits);
    let target: T;
    if (shaishTo) {
      const [cTo] = shaishToCommit(shaishTo, this.refs, this.commits);
      target = treeToObject(cTo.tree);
    } else {
      target = this.data;
    }
    const targetTree = treeToObject(cFrom.tree);

    return compare(targetTree, target);
  }

  checkout(shaish: string, createBranch?: boolean): void {
    if (createBranch) {
      validateBranchName(shaish);
      let branchRef = brancheNameToRef(shaish);
      const commit = this.commitAtHead();
      if (commit) {
        this.moveRef(branchRef, commit);
      }
      this.moveRef(REFS_HEAD_KEY, branchRef);
    } else {
      const [commit, isRef, refKey] = shaishToCommit(
        shaish,
        this.refs,
        this.commits,
      );
      this.moveTo(commit);
      this.moveRef(
        REFS_HEAD_KEY,
        isRef && refKey !== undefined ? refKey : commit,
      );
    }
  }

  async commit(
    message: string,
    author: string,
    amend?: boolean,
  ): Promise<string> {
    let parent = this.commitAtHead();
    if (amend && !parent) {
      throw new Error(`no commit to amend`);
    }

    if (parent) {
      if (amend) {
        [parent] = parent.parent
          ? shaishToCommit(parent.parent, this.refs, this.commits)
          : [parent]; // we are the very first commit in the repository
      }
    }

    const patch = generate(this.observer);
    if (
      (patch.length === 0 && !amend) ||
      (amend && message === parent?.message)
    ) {
      throw new Error(`no changes to commit`);
    }

    const timestamp = new Date();
    const parentChanges =
      amend && parent && (parent.changes?.length ?? 0 > 0)
        ? parent.changes
        : [];
    const changes = [...parentChanges, ...patch];
    const sha = await calculateCommitHash({
      message,
      author,
      changes,
      parentRef: parent?.hash,
      timestamp,
    });

    const treeHash = Buffer.from(
      compressSync(strToU8(JSON.stringify(this.data)), { level: 6, mem: 8 }),
    ).toString("base64");
    const commit = {
      hash: sha,
      message,
      author,
      changes: changes,
      parent: parent?.hash,
      timestamp,
      tree: treeHash,
    };

    if (amend) {
      const idx = this.commits.findIndex((c) => c === parent);
      this.commits.splice(idx, 1);
    }
    this.commits.push(commit);

    const headRef = this.head();
    if (headRef.includes("refs")) {
      // but move ref: refs/heads/main
      this.moveRef(headRef, commit);
    } else {
      // move detached HEAD to new commit
      this.moveRef(REFS_HEAD_KEY, commit);
    }

    return sha;
  }

  // region Commit lookups
  commitAtHead() {
    return commitAtRefIn(REFS_HEAD_KEY, this.refs, this.commits);
  }

  mustCommitAtHead() {
    const commitHead = this.commitAtHead();
    if (!commitHead) {
      throw new Error(`unreachable: HEAD or its target ref not present`);
    }
    return commitHead;
  }

  // endregion

  createBranch(name: string): string {
    validateBranchName(name);
    const branchRef = brancheNameToRef(name);
    this.saveNewRef(branchRef, name);
    return branchRef;
  }

  head(): string {
    const ref = this.refs.get(REFS_HEAD_KEY);
    if (!ref) {
      throw new Error(`unreachable: HEAD is not present`);
    }
    return cleanRefValue(ref.value);
  }

  // region History functions
  private collectCommits() {
    const commit = this.commitAtHead();
    if (!commit) {
      return [];
    }
    // traverse backwards and build commit tree
    let c: Commit | undefined = commit;
    let commitsList: Commit[] = [];
    while (c !== undefined) {
      commitsList = [c, ...commitsList];
      c = this.commits.find((parent) => parent.hash === c?.parent);
    }
    return commitsList;
  }

  getHistory(): History {
    return {
      refs: new Map(this.refs),
      commits: this.collectCommits(),
    };
  }

  logs(numberOfCommits?: number): Commit[] {
    const logs: Commit[] = [];
    const limit = numberOfCommits ?? -1;
    let c = this.commitAtHead();
    let counter = 0;
    while (c !== undefined && (limit === -1 || counter < limit)) {
      logs.push(c, ...logs);
      counter++;
      c = this.commits.find((parent) => parent.hash === c?.parent);
    }
    return logs;
  }

  // endregion

  merge(source: string | RepositoryObject<T> | History): string {
    // inspiration
    // http://think-like-a-git.net
    // also check isomorphic-git
    //   for fancier merge tree
    //   https://github.com/isomorphic-git/isomorphic-git/blob/a623133345a5d8b6bb7a8352ea9702ce425d8266/src/utils/mergeTree.js#L33

    if (typeof source !== "string") {
      // const srcHead = commitAtRefIn(REFS_HEAD, src.refs, src.commits)
      throw new Error(
        `fatal: source type (${
          source instanceof Repository ? "Repository" : "History"
        }) not implemented`,
      );
    }

    const [srcCommit] = shaishToCommit(source, this.refs, this.commits);
    const headCommit = this.mustCommitAtHead();

    // no change
    // *---* (master)
    //     |
    //     * (foo)
    if (headCommit.hash === srcCommit.hash) {
      throw new Error(`already up to date`);
    }

    // fast-forward
    // *---* (master)
    //      \
    //       *---*---* (foo)
    // result:
    // *---*
    //      \
    //       *---*---* (master, foo)
    const [isAncestor] = mapPath(headCommit, srcCommit, this.commits);
    if (isAncestor) {
      this.moveRef(this.head(), srcCommit);
      this.moveTo(srcCommit);
      return srcCommit.hash;
    }

    // todo diverge
    // *---*---* (master)
    //      \
    //       *---*---* (foo)
    // result:
    //                 ↓
    // *---*---*-------* (master)
    //      \         /
    //       *---*---* (foo)
    // if (false) {
    //  throw new Error('diverge not implemented yet')
    // }

    throw new Error("unknown merge type: not implemented yet");
  }

  // region Ref methods
  private moveRef(refName: string, value: string | Commit) {
    let ref = this.refs.get(refName);
    const val =
      typeof value === "string" ? createHeadRefValue(value) : value.hash;
    if (!ref) {
      ref = { name: getLastItem(refName), value: val };
    } else {
      ref.value = val;
    }
    this.refs.set(refName, ref);
  }

  private saveNewRef(refKey: string, name: string) {
    const headCommit = this.commitAtHead();
    if (!headCommit) {
      const headRef = this.head();
      if (!headRef) {
        throw new Error(`unreachable: HEAD not present`);
      }
      throw new Error(
        `fatal: not a valid object name: '${getLastItem(headRef)}'`,
      );
    }
    this.refs.set(refKey, { name: name, value: headCommit.hash });
  }

  ref(reference: string): string | undefined {
    const ref = this.refs.get(reference)?.value;
    return ref ? cleanRefValue(ref) : undefined;
  }

  // endregion

  tag(tag: string): string {
    try {
      validateRef(tag);
    } catch (e) {
      throw new Error(`fatal: '${tag}' is not a valid tag name`);
    }
    const tagRef = tagToRef(tag);
    try {
      this.saveNewRef(tagRef, tag);
    } catch (e) {
      // because git has to make it weird and show a different error
      //   unlike when creating a branch on a HEAD pointing to a ref which does not exist yet
      throw new Error(`fatal: failed to resolve 'HEAD' as a valid ref.`);
    }
    return tagRef;
  }
}

const treeToObject = <T = any>(tree: string): T => {
  return JSON.parse(strFromU8(decompressSync(Buffer.from(tree, "base64"))));
};

const getLastItem = (thePath: string) =>
  thePath.substring(thePath.lastIndexOf("/") + 1);

const mapPath = (
  from: Commit,
  to: Commit,
  commits: Commit[],
): [isAncestor: boolean] => {
  let c: Commit | undefined = to;
  while (c !== undefined) {
    c = commits.find((parent) => parent.hash === c?.parent);
    if (c?.hash === from.hash) {
      return [true];
    }
  }
  return [false];
};

/**
 * Returns the commit to which the provided ref is pointing
 * @param ref - needs to be in key format, e.g. refs/heads/... or refs/tags/...
 * @param references
 * @param commitsList
 */
const commitAtRefIn = (
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

const refsAtCommit = (references: Map<string, Reference>, commit: Commit) => {
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
const shaishToCommit = (
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
  refKey.indexOf(tagRefPathPrefix) > -1;

export const cleanRefValue = (ref: string) =>
  ref.replace(headValueRefPrefix, "");

export const brancheNameToRef = (name: string) => {
  return `${headsRefPathPrefix}${name}`;
};

export const tagToRef = (tag: string) => {
  return `${tagRefPathPrefix}${tag}`;
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
