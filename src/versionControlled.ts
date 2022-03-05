import { Change, History } from './interfaces'
import { calculateHash, Commit } from './commit'


export interface VersionControlledObjectType {
  new<T>(obj: T, options: VersionControllerOptions<T>): VersionControlledObject<T>
}

export interface VersionControllerOptions<T> {
  history?: History,
  TCreator?: new() => T
}

export interface VersionControlledObject<T> {
  data: T

  printChangeLog(upTo?: number): void

  getChangeLog(): Change[]

  getHistory(): History

  gotoLastVersion(): boolean

  // only for internal use. do not expose to custoemrs.
  // Customer should use commit/checkout logic
  gotoVersion(newVersion: number): boolean

  // The current object version, which we are on
  getVersion(): number

  // The current commit, which we are on.
  // It returns undefined, when the current version is not associated with a commit yet
  head(): Commit | undefined

  commit(message: string, author: string): Promise<string>

  checkout(hash: string): void

  logs(commits?: number): void

  // Helper method - mainly for testing - to create a new VersionControlledObject from the current one's history.
  // It essentially involves only two steps:
  // 1. creating a new instance of the underlying data type (T)
  // 2. constructing a new VersionControlled object with the new instance
  //    passing in the history of the current instance
  branch(): [VersionControlledObject<T>, T]

  merge(source: VersionControlledObject<T> | History): string
}

export const VersionControlled = function <T extends { [k: PropertyKey]: any }>(
  this: VersionControlledObject<T>,
  obj: T,
  options: VersionControllerOptions<T>
) {
  let savedLength: number | undefined
  let version = 0
  const changeLog = options.history?.changeLog ?? []
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

  const commit = async (message: string, author: string): Promise<string> => {
    let parent
    let from
    if (commits.length > 0) {
      parent = commits[commits.length - 1]
      from = parent.to
    }
    if (from == version) {
      throw new Error(`no changes to commit`)
    }

    const timestamp = new Date()
    const changes = changeLog.slice(from, version)
    const sha = await calculateHash({
      message,
      author,
      changes,
      parentRef: parent?.hash,
      timestamp
    })

    commits.push({
      hash: sha,
      message,
      author,
      changes: changes,
      parent: parent?.hash,
      timestamp,
      from,
      to: version
    })

    return sha
  }

  this.gotoVersion = gotoVersion
  this.gotoLastVersion = gotoLastVersion

  // region Logs
  this.printChangeLog = (upTo) => {
    printChangeLog(this, upTo)
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
      const changes = history.changeLog.slice(commit.from, commit.to)
      for (let j = changes.length - 1; j >= 0; j--) {
        const chg = changes[j]
        console.log(`    ${(commit.from ?? 0) + j}:${JSON.stringify(chg)}`)
      }
      counter++
      idx--
    }
  }
 // endregion

  this.getVersion = () => version
  this.head = () => {
    return commits.find((c) => c.to === version)
  }
  this.getChangeLog = () => [...changeLog]
  this.getHistory = (): History => {
    // only send back shallow copies of changelog and commits up to current version
    return {
      changeLog: [...changeLog.slice(undefined, version)],
      commits: [...commits.filter((c) => c.to <= version)]
    }
  }
  this.commit = commit
  this.checkout = (hash) => {
    const commit = commits.find((c) => c.hash === hash)
    if (!commit) {
      throw new Error(`commit (${hash}) does not belong to repository`)
    }
    gotoVersion(commit.to)
  }
  this.branch = () => {
    if (!options.TCreator) {
      throw new Error(`Cannot branch out, no constructor provided.
      Please branch manually: new VersionControlled(new T(), {history: vc.getHistory()})`)
    }
    const vc = new VersionControlled(
      new options.TCreator(),
      { history: this.getHistory(), TCreator: options.TCreator }
    )
    return [vc, vc.data]
  }
  this.merge = source => {
    // inspiration
    // http://think-like-a-git.net
    // also check isomorphic-git
    //   for fancier merge tree
    //   https://github.com/isomorphic-git/isomorphic-git/blob/a623133345a5d8b6bb7a8352ea9702ce425d8266/src/utils/mergeTree.js#L33

    const src = source instanceof VersionControlled
      ? source.getHistory()
      : source
    const srcHead = src.commits[src.commits.length - 1]
    const masterHead = commits[commits.length - 1]

    if (!srcHead && !masterHead) {
      throw new Error(`nothing to merge`)
    }

    // no change
    // *---* (master)
    //     |
    //     * (foo)
    if (masterHead && srcHead && srcHead.hash === masterHead.hash) {
      throw new Error(`already at commit: ${srcHead.hash}`)
    }

    // fast-forward
    // *---* (master)
    //      \
    //       *---*---* (foo)
    // result:
    // *---*
    //      \
    //       *---*---* (master, foo)
    const indexOfMasterHeadOnSrc = src.commits.indexOf(masterHead)
    if (masterHead === undefined || indexOfMasterHeadOnSrc > -1) {
      const commitsToMerge = src.commits.slice(indexOfMasterHeadOnSrc + 1)
      for (const c of commitsToMerge) {
        commits.push(c)
        changeLog.push(...src.changeLog.slice(c.from, c.to))
      }
      // let version catch up
      this.gotoLastVersion()
      return srcHead.hash // ff to last commit in source
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
  // apply change log at the end of the constructor
  gotoLastVersion()
} as any as VersionControlledObjectType

export function printChangeLog(
  vcobj: VersionControlledObject<any>,
  upTo?: number
) {
  console.log('----------------------------------------------------------')
  console.log(`Changelog at v${vcobj.getVersion()}`)
  const changeLog = vcobj.getChangeLog()
  for (const [i, chg] of changeLog.entries()) {
    if (upTo && i >= upTo) {
      return
    }

    console.log(`  ${JSON.stringify(chg)}`)
  }

  console.log('----------------------------------------------------------')
}
