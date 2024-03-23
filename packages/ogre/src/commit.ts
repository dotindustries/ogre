import { digest } from "./hash";
import { Operation } from "fast-json-patch";

export interface Commit {
  /*The hash of the commit. Is an sha256 of:
          - tree object reference (changes?)
          - parent object reference (parent hash)
          - author
          - author commit timestamp with timezone
          - commit message
        */
  hash: string;
  tree: string;

  message: string | undefined;
  author: string;

  // The hash of the parent commit
  parent: string | undefined;

  // The diff of this commit from the parent
  changes: Operation[];

  // Commit timestamp with timezone
  timestamp: Date;
}

export interface CommitHashContent {
  message: string;
  author: string;
  parentRef: string | undefined;
  changes: Operation[];
  timestamp: Date;
}

export function calculateCommitHash(content: CommitHashContent) {
  return digest(content);
}
