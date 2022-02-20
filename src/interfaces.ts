export interface Change {
  path: any[],
  newValue: any | undefined,
  oldValue: any | undefined
}

export interface History {
  changeLog: Change[]
  commits: Commit[]
}

export interface Commit {
  hash: string
  // The version number to the corresponding changelog (not zero-based index)
  // Therefore it can be used as an index, when accessing the changelog to
  // retrieve the relevant changes e.g.:
  // ```
  // const changes = changeLog.slice(commit.from, commit.to)
  // ```
  from: number | undefined
  // The version number to the corresponding changelog entry (not zero-based index)
  // Therefore it can be used as an index, when accessing the changelog to
  // retrieve the relevant changes e.g.:
  // ```
  // const changes = changeLog.slice(commit.from, commit.to)
  // ```
  to: number
  timestamp: Date
  message: string | undefined
}
