import { Change, Commit, History } from './interfaces'

const objectHash = require('object-hash')

export interface VersionControlledObject<T> {
  data: T

  printChangeLog(upTo?: number): void

  getChangeLog(): Change[]

  getHistory(): History

  gotoLastVersion(): boolean

  gotoVersion(newVersion: number): boolean

  getVersion(): number

  commit(message: string): string

  logs(commits?: number): void
}

export const VersionControlled = function <T extends { [k: PropertyKey]: any }>(this: VersionControlledObject<T>, obj: T, changeLog: Change[] = []) {
  let savedLength: number | undefined
  let version = 0
  const targets: any[] = []
  const commits: Commit[] = []
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
      target = targets[version] ||
        (targets[version] = path.reduce((o, p) => o[p], obj))
      if (chg.hasOwnProperty(val)) {
        const oldValue = chg[val]
        // Some additional care concerning the length property of arrays:
        // @nadilas workaround: array trim to empty array should not set 0:undefined
        // console.log('warn: not setting array[0]=undefined', target, property, oldValue)
        if (!(Array.isArray(target) && target.length === 0 && oldValue === undefined)) {
          target[property] = oldValue
        }
      } else {
        delete target[property]
      }

      if (version < newVersion) version++
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
    const change: Change = { path: [...changes, property], newValue: undefined, oldValue: undefined }

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

  const commit = (message: string): string => {
    let from
    if (commits.length > 0) {
      const last = commits[commits.length - 1]
      from = last.to
    }
    if (from == version) {
      throw new Error(`no changes to commit`)
    }
    const sha = objectHash(this.data, { algorithm: 'sha256' })
    commits.push({ message, from, hash: sha, to: version, timestamp: new Date() })

    return sha
  }

  this.gotoVersion = gotoVersion
  this.gotoLastVersion = gotoLastVersion
  this.printChangeLog = upTo => {
    printChangeLog(this, upTo)
  }
  this.logs = numberOfCommits => {
    const limit = numberOfCommits ?? -1
    const history = this.getHistory()
    let idx = history.commits.length-1
    let counter = 0
    while (idx >= 0) {
      if (limit == counter) {
        break
      }
      const commit = history.commits[idx]
      console.log(`${commit.hash} - ${commit.timestamp.toISOString()}`)
      console.log(`  ${commit.message}`)
      const changes = history.changeLog.slice(commit.from, commit.to)
      for (let j = changes.length-1; j >= 0; j--) {
        const chg = changes[j]
        console.log(`    ${(commit.from??0)+j}:${JSON.stringify(chg)}`)
      }
      counter++
      idx--
    }
  }

  this.getVersion = () => version
  this.getChangeLog = () => [...changeLog]
  this.getHistory = (): History => {
    // only send back shallow copies
    return { changeLog: [...changeLog], commits: [...commits] }
  }
  this.commit = commit
  // apply change log on construction
  gotoLastVersion()
} as any as { new<T>(obj: T, changeLog?: Change[]): VersionControlledObject<T> }

export function printChangeLog(vcobj: VersionControlledObject<any>, upTo?: number) {
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
