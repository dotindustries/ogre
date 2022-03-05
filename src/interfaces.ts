import { Commit } from './commit'

export interface Change {
  path: any[]
  newValue: any | undefined
  oldValue: any | undefined
}

export interface History {
  changeLog: Change[]
  commits: Commit[]
}
