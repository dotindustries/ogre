import { Change, History, Reference } from './interfaces'
import { calculateHash, Commit } from './commit'
import { validBranch } from './ref'

export interface RepositoryOptions<T> {
  history?: History
}

export interface RepositoryObject<T> {
  data: T

  printChangeLog(upTo?: number): void

  getChangeLog(): Change[]

  getHistory(): History

  // It returns the reference where we are currently at
  head(): string

  // Returns the commit hash to which a reference points
  ref(reference: string): string | undefined

  commit(message: string, author: string, amend?: boolean): Promise<string>

  checkout(shaish: string, createBranch?: boolean): void

  logs(commits?: number): void

  // Helper method - mainly for testing - to create a new VersionControlledObject from the current one's history.
  // It essentially involves only two steps:
  // 1. creating a new instance of the underlying data type (T)
  // 2. constructing a new VersionControlled object with the new instance
  //    passing in the history of the current instance
  createBranch(name: string): string

  merge(source: string | RepositoryObject<T> | History): string

  branch(): string

}

export interface RespositoryObjectType {
  new<T>(obj: T, options: RepositoryOptions<T>): RepositoryObject<T>
}

const REFS_HEAD = 'HEAD'
const REFS_MAIN = 'refs/heads/main'

const refPrefix = 'ref: '
export const Repository = function <T extends { [k: PropertyKey]: any }>(
  this: RepositoryObject<T>,
  obj: T,
  options: RepositoryOptions<T>
) {
  let savedLength: number | undefined
  let version = 0
  const refs: Map<string, Reference> = options.history?.refs ?? new Map<string, Reference>([[REFS_HEAD, {
    name: REFS_HEAD,
    value: `ref: ${REFS_MAIN}`
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

  // region Logs
  this.printChangeLog = (upTo) => {
    console.log('----------------------------------------------------------')
    console.log(`Changelog at v${version}`)
    const changeLog = this.getChangeLog()
    for (const [i, chg] of changeLog.entries()) {
      if (upTo && i >= upTo) {
        return
      }

      console.log(`  ${JSON.stringify(chg)}`)
    }

    console.log('----------------------------------------------------------')
  }
  this.logs = (numberOfCommits) => {
    const limit = numberOfCommits ?? -1
    const history = this.getHistory()
    let idx = history.commits.length - 1
    let counter = 0
    while (idx >= 0) {
      if (limit == counter) {
        break
      }
      const commit = history.commits[idx]
      console.log(`${commit.hash} - ${commit.timestamp.toISOString()}`)
      console.log(`  ${commit.message}`)
      for (let j = commit.changes.length - 1; j >= 0; j--) {
        const chg = commit.changes[j]
        console.log(`    ${j}:${JSON.stringify(chg)}`)
      }
      counter++
      idx--
    }
  }
  // endregion

  this.head = () => {
    const ref = refs.get(REFS_HEAD)
    if (!ref) {
      throw new Error(`unreachable: HEAD is not present`)
    }
    return cleanRefValue(ref.value)
  }

  this.ref = (reference) => {
    const ref = refs.get(reference)?.value
    return ref ? cleanRefValue(ref) : undefined
  }

  this.getChangeLog = () => [...changeLog]

  this.getHistory = (): History => {
    // only send back shallow copies of changelog and commits up to current version
    return {
      refs: new Map(refs),
      commits: [...commits.filter((c) => c.to <= version)]
    }
  }

  const commitAt = (ref: string, references: Map<string, Reference>, commitsList: Commit[]) => {
    const reference = references.get(ref)
    if (!reference) {
      throw new Error(`unreachable: '${ref}' is not present`)
    }
    let commitHash
    if (reference.value.includes(refPrefix)) {
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

  const commitAtHead = () => {
    return commitAt(REFS_HEAD, refs, commits)
  }
  const mustCommitAtHead = () => {
    const commitHead = commitAtHead()
    if (!commitHead) {
      throw new Error(`unreachable: HEAD or its target ref not present`)
    }
    return commitHead
  }

  this.commit = async (message, author, amend = false): Promise<string> => {
    let parent = commitAtHead()
    if (amend && !parent) {
      throw new Error(`no commit to amend`)
    }
    if (parent) {
      if (amend) {
        [parent] = parent.parent ? shaishToCommit(parent.parent) : [undefined]
      }
    }
    const changesSinceLastCommit = changeLog.slice(parent?.to)
    if (changesSinceLastCommit.length === 0) {
      throw new Error(`no changes to commit`)
    }

    const timestamp = new Date()
    const changes = [...changesSinceLastCommit]
    const sha = await calculateHash({
      message,
      author,
      changes,
      parentRef: parent?.hash,
      timestamp
    })

    const commit = {
      hash: sha,
      message,
      author,
      changes: changes,
      parent: parent?.hash,
      timestamp,
      to: version
    }
    if (amend) {
      const idx = commits.findIndex(c => c === parent)
      commits.splice(idx, 1)
    }
    commits.push(commit)

    const head = refs.get(REFS_HEAD)?.value
    // ignore sha
    if (head?.includes(refPrefix)) {
      // but move ref: refs/heads/main
      moveRef(cleanRefValue(head), commit)
    }

    return sha
  }

  const rebuildChangeLog = (commit: Commit) => {
    // clear current state
    changeLog.splice(0)
    version = 0

    // traverse backwards and build changelog
    let c: Commit | undefined = commit
    let clog: Change[] = []
    while (c !== undefined) {
      clog = [...commit.changes, ...clog]
      c = commits.find(parent => parent.hash === c?.parent)
    }
    changeLog.push(...clog)

    // process new changelog
    gotoLastVersion()
  }

  // accept a shaish expression (e.g. branch, tag, refs/*/*, commitSha)
  const shaishToCommit = (shaish: string): [commit: Commit, isRef: boolean, ref: string | undefined] => {
    let sha = shaish
    let isRef = false
    let refKey: string | undefined = undefined

    // check for refs
    for (const [name, ref] of refs.entries()) {
      // match on
      if (ref.name === shaish || name === shaish) {
        isRef = true
        refKey = name
        sha = ref.value
        if (sha.includes(refPrefix)) {
          const cleanedRef = cleanRefValue(sha)
          const c = commitAt(cleanedRef, refs, commits)
          if (!c) {
            throw new Error(`${cleanedRef} points to non-existing commit`)
          }
          return [c, isRef, refKey]
        }
        break
      }
    }
    // check for partial sha matches
    const found = commits.filter(c => c.hash.indexOf(sha) > -1)
    if (found.length === 0) {
      throw new Error(`${shaish} does not belong to repository`)
    }
    // but sha should be specific enough to resolve to 1 commit
    if (found.length > 1) {
      throw new Error(`commit `)
    }
    return [found[0], isRef, refKey]
  }

  this.checkout = (shaish, createBranch = false) => {
    if (createBranch) {
      validateBranchName(shaish)
      moveRef(REFS_HEAD, brancheNameToRef(shaish))
    } else {
      const [commit, isRef, refKey] = shaishToCommit(shaish)
      rebuildChangeLog(commit)
      moveRef(REFS_HEAD, isRef && refKey !== undefined ? refKey : commit)
    }
  }

  this.branch = () => {
    const currentHeadRef = refs.get(REFS_HEAD)
    if (!currentHeadRef) {
      throw new Error('unreachable: ref HEAD not available')
    }

    if (currentHeadRef.value.includes(refPrefix)) {
      const refName = cleanRefValue(currentHeadRef.value)
      if (refs.has(refName))
        return getLastItem(refName)
    }

    return REFS_HEAD // detached state
  }

  const brancheNameToRef = (name: string) => {
    return `refs/heads/${name}`
  }

  const validateBranchName = (name: string) => {
    if (!validBranch(name)) {
      throw new Error(`invalid ref name`)
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
    const val = typeof value === 'string' ? `${refPrefix}${value}` : value.hash
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
      // const srcHead = commitAt(REFS_HEAD, src.refs, src.commits)
      throw new Error(`fatal: source type (${source instanceof Repository ? 'Repository' : 'History'}) not implemented`)
    }

    const [srcCommit] = shaishToCommit(source)
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
    // const indexOfMasterHeadOnSrc = src.commits.indexOf(masterHead)
    // if (masterHead === undefined || indexOfMasterHeadOnSrc > -1) {
    //   const commitsToMerge = src.commits.slice(indexOfMasterHeadOnSrc + 1)
    //   for (const c of commitsToMerge) {
    //     commits.push(c)
    //   }
    //
    //   moveRef(this.head(), commitsToMerge[commitsToMerge.length - 1])
    //
    //   // let version catch up
    //   const commitHEAD = commitAtHead()
    //   if (!commitHEAD) {
    //     throw new Error(`HEAD at destination does not point to any commits`)
    //   }
    //   rebuildChangeLog(commitHEAD)
    //   return commitHEAD.hash // ff to last commit in source
    // }

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

  // apply change log at the end of the constructor
  const headCommit = commitAtHead()
  if (headCommit) {
    rebuildChangeLog(headCommit)
  }
} as any as RespositoryObjectType

const getLastItem = (thePath: string) => thePath.substring(thePath.lastIndexOf('/') + 1)
const cleanRefValue = (ref: string) => ref.replace(refPrefix, '')
