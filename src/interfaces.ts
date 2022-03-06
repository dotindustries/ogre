import { Commit } from './commit'

export interface Reference {
  name: string
  // A reference can point to a commit via its sha256
  // or it can point to a reference
  value: string
}

export interface Change {
  path: any[]
  newValue: any | undefined
  oldValue: any | undefined
}

export interface History {
  changeLog: Change[]
  commits: Commit[]
}
