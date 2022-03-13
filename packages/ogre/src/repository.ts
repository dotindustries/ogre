import { Change, History, Reference } from './interfaces'
import { calculateCommitHash, Commit } from './commit'
import { validBranch } from './ref'
import {digest} from './hash'

const tagRefPathPrefix = 'refs/tags/'
const headsRefPathPrefix = 'refs/heads/'
const headValueRefPrefix = 'ref: '

export const REFS_HEAD_KEY = 'HEAD'
export const REFS_MAIN_KEY = `${headsRefPathPrefix}main`


export interface RepositoryOptions<T> {
  history?: History
}

export interface RepositoryObject<T> {
  data: T

  getHistory(): History

  // It returns the reference where we are currently at
  head(): string

  // Returns the commit hash to which a reference points
  ref(reference: string): string | undefined

  commit(message: string, author: string, amend?: boolean): Promise<string>

  checkout(shaish: string, createBranch?: boolean): void

  logs(commits?: number): Commit[]

  createBranch(name: string): string

  merge(source: string | RepositoryObject<T> | History): string

  branch(): string

}

export interface RespositoryObjectType {
  new<T>(obj: T, options: RepositoryOptions<T>): RepositoryObject<T>
}

/**
 * A repository recording and managing the state transitions of an object
 */
export const Repository = function <T extends { [k: PropertyKey]: any }>(
  this: RepositoryObject<T>,
  obj: T,
  options: RepositoryOptions<T>
) {
  let savedLength: number | undefined
  let version = 0
  const refs: Map<string, Reference> = options.history?.refs ?? new Map<string, Reference>([[REFS_HEAD_KEY, {
    name: REFS_HEAD_KEY,
    value: `ref: ${REFS_MAIN_KEY}`
  }]])
  const changeLog: Change[] = []
  const targets: any[] = []
  const commits: Commit[] = options.history?.commits ?? []
  const hash: Map<T, any[]> = new Map([[obj, []]])
  const handler = {
    get: function(target: T, property: PropertyKey): any {
      const x = target[property]
      if (Object(x) !== x) return x
      const arr = hash.get(target) ?? []
      hash.set(x, [...arr, property])
      return new Proxy(x, handler)
    },
    set: update,
    deleteProperty: update
  }

  function gotoVersion(newVersion: number) {
    newVersion = Math.max(0, Math.min(changeLog.length, newVersion))
    let chg
    let target
    let path
    let property

    const val = newVersion > version ? 'newValue' : 'oldValue'
    while (version !== newVersion) {
      if (version > newVersion) version--
      chg = changeLog[version]
      path = [...chg.path]
      property = path.pop()
      target =
        targets[version] ||
        (targets[version] = path.reduce((o, p) => o[p], obj))
      if (chg.hasOwnProperty(val)) {
        const oldValue = chg[val]
        // Some additional care concerning the length property of arrays:
        // @nadilas workaround: array trim to empty array should not set 0:undefined
        // console.log('warn: not setting array[0]=undefined', target, property, oldValue)
        if (
          !(
            Array.isArray(target) &&
            target.length === 0 &&
            oldValue === undefined
          )
        ) {
          target[property] = oldValue
        }
      } else {
        delete target[property]
      }

      if (version < newVersion) {
        version++
      }
    }

    return true
  }

  function gotoLastVersion() {
    return gotoVersion(changeLog.length)
  }

  function update(target: T, property: PropertyKey, value?: any) {
    // only last version can be modified
    gotoLastVersion()
    const changes = hash.get(target) ?? []
    const change: Change = {
      path: [...changes, property],
      newValue: undefined,
      oldValue: undefined
    }

    if (arguments.length > 2) change.newValue = value
    // Some care concerning the length property of arrays:
    if (Array.isArray(target) && Number(property) >= target.length) {
      savedLength = target.length
    }

    if (property in target) {
      if (property === 'length' && savedLength !== undefined) {
        change.oldValue = savedLength
        savedLength = undefined
      } else {
        change.oldValue = target[property]
      }
    }

    changeLog.push(change)
    targets.push(target)
    return gotoLastVersion()
  }

  this.data = new Proxy(obj, handler)

  // region Read state read
  this.head = () => {
    const ref = refs.get(REFS_HEAD_KEY)
    if (!ref) {
      throw new Error(`unreachable: HEAD is not present`)
    }
    return cleanRefValue(ref.value)
  }
  this.ref = (reference) => {
    const ref = refs.get(reference)?.value
    return ref ? cleanRefValue(ref) : undefined
  }
  this.branch = () => {
    const currentHeadRef = refs.get(REFS_HEAD_KEY)
    if (!currentHeadRef) {
      throw new Error('unreachable: ref HEAD not available')
    }

    if (currentHeadRef.value.includes(headValueRefPrefix)) {
      const refName = cleanRefValue(currentHeadRef.value)
      if (refs.has(refName))
        return getLastItem(refName)
    }

    return REFS_HEAD_KEY // detached state
  }
  // endregion

  // region History functions
  const collectCommits = () => {
    const commit = commitAtHead()
    if (!commit) {
      return []
    }
    // traverse backwards and build commit tree
    let c: Commit | undefined = commit
    let commitsList: Commit[] = []
    while (c !== undefined) {
      commitsList = [c, ...commitsList]
      c = commits.find(parent => parent.hash === c?.parent)
    }
    return commitsList
  }
  const rebuildChangeLog = (commit: Commit) => {
    // clear current state
    changeLog.splice(0)
    version = 0

    // traverse backwards and build changelog
    let clog = traverseAndCollectChangelog(commit, commits)
    changeLog.push(...clog)

    // process new changelog
    gotoLastVersion()
  }
  this.logs = (numberOfCommits) => {
    const logs: Commit[] = []
    const limit = numberOfCommits ?? -1
    let c = commitAtHead()
    let counter = 0
    while(c !== undefined && (limit === -1 || counter < limit)) {
      logs.push(c, ...logs)
      counter++
      c = commits.find(parent => parent.hash === c?.parent)
    }
    return logs
  }
  // endregion

  this.getHistory = (): History => {
    // only send back shallow copies of changelog and commits up to current version
    return {
      refs: new Map(refs),
      commits: collectCommits()
    }
  }

  // region Commit lookups
  const commitAtHead = () => {
    return commitAtRefIn(REFS_HEAD_KEY, refs, commits)
  }
  const mustCommitAtHead = () => {
    const commitHead = commitAtHead()
    if (!commitHead) {
      throw new Error(`unreachable: HEAD or its target ref not present`)
    }
    return commitHead
  }
  // endregion

  this.commit = async (message, author, amend = false): Promise<string> => {
    let parent = commitAtHead()
    if (amend && !parent) {
      throw new Error(`no commit to amend`)
    }
    if (parent) {
      if (amend) {
        [parent] = parent.parent ? shaishToCommit(parent.parent, refs, commits) : [undefined]
      }
    }
    const changesSinceLastCommit = changeLog.slice(parent?.to)
    if (changesSinceLastCommit.length === 0) {
      throw new Error(`no changes to commit`)
    }

    const timestamp = new Date()
    const changes = [...changesSinceLastCommit]
    const sha = await calculateCommitHash({
      message,
      author,
      changes,
      parentRef: parent?.hash,
      timestamp
    })
    const treeHash = await digest(obj)

    const commit = {
      hash: sha,
      message,
      author,
      changes: changes,
      parent: parent?.hash,
      timestamp,
      to: version,
      tree: treeHash
    }
    if (amend) {
      const idx = commits.findIndex(c => c === parent)
      commits.splice(idx, 1)
    }
    commits.push(commit)

    const headRef = this.head()
    if (headRef.includes('refs')) {
      // but move ref: refs/heads/main
      moveRef(headRef, commit)
    } else {
      // move detached HEAD to new commit
      moveRef(REFS_HEAD_KEY, commit)
    }

    return sha
  }

  // region Graph manipulation
  this.checkout = (shaish, createBranch = false) => {
    if (createBranch) {
      validateBranchName(shaish)
      let branchRef = brancheNameToRef(shaish)
      const commit = commitAtHead()
      if (commit) {
        moveRef(branchRef, commit)
      }
      moveRef(REFS_HEAD_KEY, branchRef)
    } else {
      const [commit, isRef, refKey] = shaishToCommit(shaish, refs, commits)
      rebuildChangeLog(commit)
      moveRef(REFS_HEAD_KEY, isRef && refKey !== undefined ? refKey : commit)
    }
  }
  this.createBranch = (name) => {
    validateBranchName(name)
    const refName = brancheNameToRef(name)
    const headCommit = commitAtHead()
    if (!headCommit) {
      const headRef = this.head()
      if (!headRef) {
        throw new Error(`unreachable: HEAD not present`)
      }
      throw new Error(`fatal: not a valid object name: '${getLastItem(headRef)}'`)
    }
    refs.set(refName, { name: name, value: headCommit.hash })
    return refName
  }
  const moveRef = (refName: string, value: string | Commit) => {
    let ref = refs.get(refName)
    const val = typeof value === 'string' ? createHeadRefValue(value) : value.hash
    if (!ref) {
      ref = { name: getLastItem(refName), value: val }
    } else {
      ref.value = val
    }
    refs.set(refName, ref)
  }
  this.merge = source => {
    // inspiration
    // http://think-like-a-git.net
    // also check isomorphic-git
    //   for fancier merge tree
    //   https://github.com/isomorphic-git/isomorphic-git/blob/a623133345a5d8b6bb7a8352ea9702ce425d8266/src/utils/mergeTree.js#L33

    if (typeof source !== 'string') {
      // const srcHead = commitAtRefIn(REFS_HEAD, src.refs, src.commits)
      throw new Error(`fatal: source type (${source instanceof Repository ? 'Repository' : 'History'}) not implemented`)
    }

    const [srcCommit] = shaishToCommit(source, refs, commits)
    const headCommit = mustCommitAtHead()

    // no change
    // *---* (master)
    //     |
    //     * (foo)
    if (headCommit.hash === srcCommit.hash) {
      throw new Error(`already up to date`)
    }

    // fast-forward
    // *---* (master)
    //      \
    //       *---*---* (foo)
    // result:
    // *---*
    //      \
    //       *---*---* (master, foo)
    const [isAncestor] = mapPath(headCommit, srcCommit, commits)
    if (isAncestor) {
      moveRef(this.head(), srcCommit)
      rebuildChangeLog(srcCommit)
      return srcCommit.hash
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

    throw new Error('unknown merge type: not implemented yet')
  }
  // endregion

  // apply change log at the end of the constructor
  const headCommit = commitAtHead()
  if (headCommit) {
    rebuildChangeLog(headCommit)
  }
} as any as RespositoryObjectType

const getLastItem = (thePath: string) => thePath.substring(thePath.lastIndexOf('/') + 1)

/**
 * Traverses the commit tree backwards and reassembles the changelog
 * @param commit
 * @param commitsList
 */
const traverseAndCollectChangelog = (commit: Commit, commitsList: Commit[]) => {
  let c: Commit | undefined = commit
  let clog: Change[] = []
  while (c !== undefined) {
    clog = [...commit.changes, ...clog]
    c = commitsList.find(parent => parent.hash === c?.parent)
  }
  return clog
}

const mapPath = (from: Commit, to: Commit, commits: Commit[]): [isAncestor: boolean] => {
  let c: Commit | undefined = to
  while (c !== undefined) {
    c = commits.find(parent => parent.hash === c?.parent)
    if (c?.hash === from.hash) {
      return [true]
    }
  }
  return [false]
}

/**
 * Returns the commit to which the provided ref is pointing
 * @param ref - needs to be in key format, e.g. refs/heads/... or refs/tags/...
 * @param references
 * @param commitsList
 */
const commitAtRefIn = (ref: string, references: Map<string, Reference>, commitsList: Commit[]) => {
  const reference = references.get(ref)
  if (!reference) {
    throw new Error(`unreachable: '${ref}' is not present`)
  }
  let commitHash
  if (reference.value.includes(headValueRefPrefix)) {
    const refKey = cleanRefValue(reference.value)
    const targetRef = references.get(refKey)
    if (!targetRef) {
      // target branch may not have been saved yet
      return undefined
    }
    commitHash = targetRef.value
  } else {
    commitHash = reference.value
  }
  for (const c of commitsList) {
    if (c.hash === commitHash) {
      return c
    }
  }
  return undefined
}

/**
 * Accepts a shaish expression (e.g. refs (branches, tags), commitSha) and returns
 * - a commit of type Commit
 * - isRef boolean whether it is a direct reference
 * - ref the key of the reference
*/
const shaishToCommit = (shaish: string, references: Map<string, Reference>, commitsList: Commit[]): [commit: Commit, isRef: boolean, ref: string | undefined] => {
  let sha = shaish
  let isRef = false
  let refKey: string | undefined = undefined

  // check for refs
  for (const [name, ref] of references.entries()) {
    // match on
    if (ref.name === shaish || name === shaish) {
      isRef = true
      refKey = name
      sha = ref.value
      if (sha.includes(headValueRefPrefix)) {
        const cleanedRef = cleanRefValue(sha)
        const c = commitAtRefIn(cleanedRef, references, commitsList)
        if (!c) {
          throw new Error(`${cleanedRef} points to non-existing commit`)
        }
        return [c, isRef, refKey]
      }
      break
    }
  }
  // check for partial sha matches
  const found = commitsList.filter(c => c.hash.indexOf(sha) > -1)
  if (found.length === 0) {
    throw new Error(`pathspec '${shaish}' did not match any known refs`)
  }
  // but sha should be specific enough to resolve to 1 commit
  if (found.length > 1) {
    throw new Error(`commit `)
  }
  return [found[0], isRef, refKey]
}

export const createHeadRefValue = (refKey: string) => {
  return `${headValueRefPrefix}${refKey}`
}

export const isTagRef = (refKey: string) => refKey.indexOf(tagRefPathPrefix) > -1

export const cleanRefValue = (ref: string) => ref.replace(headValueRefPrefix, '')

export const brancheNameToRef = (name: string) => {
  return `${headsRefPathPrefix}${name}`
}

export const validateBranchName = (name: string) => {
  if (!validBranch(name)) {
    throw new Error(`invalid ref name`)
  }
}

/**
 * Prints the underlying changelog of a repository
 * @param repository
 */
export const printChangeLog = <T>(repository: RepositoryObject<T>) => {
  console.log('----------------------------------------------------------')
  console.log(`Changelog at ${repository.head()}`)
  const history = repository.getHistory()
  const head = commitAtRefIn(repository.head(), history.refs, history.commits)
  if (!head) {
    throw new Error(`fatal: HEAD is not defined`)
  }
  const changeLog = traverseAndCollectChangelog(head, history.commits)
  for (const [, chg] of changeLog.entries()) {
    console.log(`  ${JSON.stringify(chg)}`)
  }

  console.log('----------------------------------------------------------')
}
