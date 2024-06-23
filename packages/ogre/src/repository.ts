import {
  applyPatch,
  applyReducer,
  compare,
  deepClone,
  generate,
  JsonPatchError,
  observe,
  Observer,
  Operation,
  unobserve,
  validate,
} from "fast-json-patch";
import type { Commit, CommitHashContent } from "./commit.js";
import type { History, Reference } from "./interfaces.js";
import {
  brancheNameToRef,
  cleanRefValue,
  commitAtRefIn,
  createHeadRefValue,
  getLastRefPathElement,
  headValueRefPrefix,
  immutableArrayCopy,
  immutableMapCopy,
  localHeadPathPrefix,
  mapPath,
  mutableMapCopy,
  REFS_HEAD_KEY,
  REFS_MAIN_KEY,
  refsAtCommit,
  shaishToCommit,
  tagToRef,
  validateBranchName,
  validateRef,
} from "./utils.js";

export interface RepositoryOptions {
  history?: History;
  overrides?: {
    calculateCommitHashFn?: (content: CommitHashContent) => Promise<string>;
    serializeObjectFn?: (obj: any) => string;
    deserializeObjectFn?: <T>(str: string) => T;
  };
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
  diff(shaishFrom: string, shaishTo?: string): Promise<Array<Operation>>;

  /**
   * Returns pending changes.
   */
  status(): Promise<Array<Operation>>;

  /**
   * Applies a patch to the repository's HEAD
   * @param patch
   */
  apply(patch: Array<Operation>): void;

  // It returns the reference where we are currently at
  head(): string;

  // Returns the commit hash to which a reference points
  ref(reference: string): string | undefined;

  commit(message: string, author: string, amend?: boolean): Promise<string>;

  checkout(shaish: string, createBranch?: boolean): Promise<void>;

  logs(commits?: number): Array<Commit>;

  createBranch(name: string): string;

  merge(source: string | RepositoryObject<T> | History): Promise<string>;

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
  reset(mode?: "soft" | "hard", shaish?: string): Promise<void>;

  /**
   * Returns the remote references from the initialization of the repository.
   * The returned map is a readonly of remote.
   */
  remote(): ReadonlyMap<string, Readonly<Reference>> | undefined;

  /**
   * Cherry returns the commits that are missing from upstream and the refs that have been moved since remote
   */
  cherry(): { commits: Array<Commit>; refs: Map<string, Reference> };
}

/**
 * A repository recording and managing the state transitions of an object
 */
export class Repository<T extends { [k: PropertyKey]: any }>
  implements RepositoryObject<T>
{
  constructor(obj: Partial<T>, options: RepositoryOptions) {
    this.hashFn = options.overrides?.calculateCommitHashFn;
    this.serializeObjectFn = options.overrides?.serializeObjectFn;
    this.deserializeObjectFn = options.overrides?.deserializeObjectFn;
    // FIXME: move this to refs/remote as git would do?
    this.remoteRefs = immutableMapCopy(options.history?.refs);
    this.remoteCommits = immutableArrayCopy<Commit, string>(
      options.history?.commits,
      (c) => c.hash,
    );
    this.original = deepClone(obj);
    // store js ref, so obj can still be modified without going through repo.data
    this.data = obj as T;
    this.observer = observe(obj as T);
    this.refs = options.history?.refs
      ? mutableMapCopy(options.history?.refs)
      : new Map<string, Reference>([
          [
            REFS_HEAD_KEY,
            {
              name: REFS_HEAD_KEY,
              value: `ref: ${REFS_MAIN_KEY}`,
            },
          ],
        ]);

    this.commits = options.history?.commits ?? [];

    if (!options.history) {
      this._isReady = true;
      return;
    }

    // restore history
    const commit = this.commitAtHead();
    if (!commit) {
      this._isReady = true;
      return;
    }
    this.moveTo(commit).then(() => {
      this._isReady = true;
    });
  }

  private readonly original: T;
  private _isReady = false;

  isReady(): Promise<boolean> {
    const self = this;

    function checkFlag(callback: (ok: boolean) => void) {
      if (self._isReady === true) {
        callback(true);
      } else {
        setTimeout(() => checkFlag(callback), 10);
      }
    }

    return new Promise((resolve) => {
      checkFlag(resolve);
    });
  }

  data: T;
  private readonly hashFn:
    | ((content: CommitHashContent) => Promise<string>)
    | undefined;

  private readonly serializeObjectFn: ((obj: any) => string) | undefined;

  private readonly deserializeObjectFn: (<T>(str: string) => T) | undefined;

  // stores the remote state upon initialization
  private readonly remoteRefs:
    | ReadonlyMap<string, Readonly<Reference>>
    | undefined;

  // stores the remote state upon initialization
  private readonly remoteCommits: ReadonlyArray<Readonly<string>> | undefined;

  private observer: Observer<T>;

  private readonly refs: Map<string, Reference>;
  private readonly commits: Array<Commit>;

  cherry(): { commits: Array<Commit>; refs: Map<string, Reference> } {
    const commits: Array<Commit> = [];
    const refs = new Map<string, Reference>();

    const collectedHashes: Array<string> = [];
    const shouldExclude = (hash: string) =>
      this.remoteCommits?.includes(hash) || collectedHashes.includes(hash);
    const collect = (c: Commit) => {
      // we can't include remote state in the pending report
      if (shouldExclude(c.hash)) {
        return false;
      }
      commits.push(c);
      collectedHashes.push(c.hash);
      return true;
    };
    // collect ref updates and commits that are not present on the remote
    for (const [key, ref] of this.refs) {
      if (key === REFS_HEAD_KEY) {
        continue;
      }
      const remote = this.remoteRefs?.get(key);
      if (!remote) {
        // if we have no remote pair, we need to sync the ref
        refs.set(key, ref);
        const localCommit = this.commits.find((c) => c.hash === ref.value);
        // if ref is not pointing to a commit move on
        if (!localCommit) {
          continue;
        }
        // map all commits to root
        const [isAncestor, path] = mapPath(
          this.commits,
          localCommit,
          undefined,
        );

        if (isAncestor) {
          for (let i = 0; i < path.length; i++) {
            const commit = path[i];
            collect({
              hash: commit.hash,
              author: commit.author,
              changes: commit.changes,
              message: commit.message,
              parent: commit.parent,
              timestamp: commit.timestamp,
              tree: commit.tree,
            });
          }
        }
        continue;
      }

      if (remote.value === ref.value) {
        // early exit if remote is the same
        continue;
      }

      // local and remote refs differ
      refs.set(key, ref);
      const localCommit = this.commits.find((c) => c.hash === ref.value);
      // if ref is not pointing to a commit move on
      if (!localCommit) {
        continue;
      }
      // FIXME: do we have to have the remote ref as a commit locally?
      const remoteCommit = this.commits.find((c) => c.hash === remote.value)!;
      const [isAncestor, path] = mapPath(
        this.commits,
        localCommit,
        remoteCommit,
      );

      if (isAncestor) {
        for (let i = 0; i < path.length; i++) {
          const commit = path[i];
          collect({
            hash: commit.hash,
            author: commit.author,
            changes: commit.changes,
            message: commit.message,
            parent: commit.parent,
            timestamp: commit.timestamp,
            tree: commit.tree,
          });
        }
      }
    }

    return { commits, refs };
  }

  remote(): ReadonlyMap<string, Readonly<Reference>> | undefined {
    return this.remoteRefs;
  }

  private async moveTo(commit: Commit) {
    const deserializeFn =
      this.deserializeObjectFn ?? (await import("./serialize.js")).treeToObject;
    const targetTree = deserializeFn<T>(commit.tree);
    const patchToTarget = compare(this.data, targetTree);
    if (!patchToTarget || patchToTarget.length < 1) {
      return;
    }
    this.observer.unobserve();
    patchToTarget.reduce(applyReducer, this.data);
    this.observer = observe(this.data);
  }

  apply(patch: Array<Operation>): JsonPatchError | undefined {
    const p = deepClone(patch) as Array<Operation>;
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

  async reset(
    mode: "soft" | "hard" | undefined = "hard",
    shaish: string | undefined = REFS_HEAD_KEY,
  ): Promise<void> {
    if (mode === "hard") {
      unobserve(this.data, this.observer);
    }

    const [commit] = shaishToCommit(shaish, this.refs, this.commits);
    await this.moveTo(commit);

    const refs = refsAtCommit(this.refs, commit);
    // reset only moves heads and not tags
    const moveableRefs = refs.filter((r) =>
      r.name.startsWith(localHeadPathPrefix()),
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
      if (this.refs.has(refName)) return getLastRefPathElement(refName);
    }

    return REFS_HEAD_KEY; // detached state
  }

  async status() {
    const commit = this.commitAtHead();
    if (!commit) {
      // on root repo return the pending changes
      return compare(this.original, this.data); // this.observer.patches is empty?? :(
    }
    return this.diff(commit.hash);
  }

  async diff(shaishFrom: string, shaishTo?: string): Promise<Array<Operation>> {
    const [cFrom] = shaishToCommit(shaishFrom, this.refs, this.commits);
    let target: T;
    const deserializeFn =
      this.deserializeObjectFn ?? (await import("./serialize.js")).treeToObject;
    if (shaishTo) {
      const [cTo] = shaishToCommit(shaishTo, this.refs, this.commits);
      target = deserializeFn(cTo.tree);
    } else {
      target = this.data;
    }
    const targetTree = deserializeFn<T>(cFrom.tree);

    return compare(targetTree, target);
  }

  async checkout(shaish: string, createBranch?: boolean): Promise<void> {
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
      await this.moveTo(commit);
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
    const calculateCommitHash =
      this.hashFn ?? (await import("./commit.js")).calculateCommitHash;

    const sha = await calculateCommitHash({
      message,
      author,
      changes,
      parentRef: parent?.hash,
      timestamp,
    });

    const serializeFn =
      this.serializeObjectFn ?? (await import("./serialize.js")).objectToTree;

    const treeHash = serializeFn(this.data);
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
    let commitsList: Array<Commit> = [];
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

  logs(numberOfCommits?: number): Array<Commit> {
    const logs: Array<Commit> = [];
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

  async merge(source: string | RepositoryObject<T> | History): Promise<string> {
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
    const [isAncestor] = mapPath(this.commits, srcCommit, headCommit);
    if (isAncestor) {
      this.moveRef(this.head(), srcCommit);
      await this.moveTo(srcCommit);
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
      ref = { name: getLastRefPathElement(refName), value: val };
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
        `fatal: not a valid object name: '${getLastRefPathElement(headRef)}'`,
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
