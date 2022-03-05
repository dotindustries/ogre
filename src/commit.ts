import { Change } from './interfaces'
import { digest } from './hash'

export interface Commit {
  // The hash of the commit
  // Is an sha256 of:
  // - tree object reference (changes?)
  // - parent object reference (parent hash)
  // - author
  // - author commit timestamp with timezone
  // - commit message
  hash: string

  message: string | undefined
  author: string

  // The hash of the parent commit
  parent: string | undefined

  // The diff of this commit from the parent
  changes: Change[]

  // Commit timestamp with timezone
  timestamp: Date

  // The version number to the corresponding changelog (not zero-based index)
  // Therefore it can be used as an index, when accessing the changelog to
  // retrieve the relevant changes e.g.:
  // ```
  // const changes = changeLog.slice(commit.from, commit.to)
  // ```
  from: number | undefined;

  // The version number to the corresponding changelog entry (not zero-based index)
  // Therefore it can be used as an index, when accessing the changelog to
  // retrieve the relevant changes e.g.:
  // ```
  // const changes = changeLog.slice(commit.from, commit.to)
  // ```
  to: number;
}

export interface HashContent {
  message: string
  author: string
  parentRef: string | undefined
  changes: Change[]
  timestamp: Date
}

export function calculateHash(content: HashContent) {
  return digest(content)
}
