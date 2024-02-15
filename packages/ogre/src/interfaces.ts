import { Commit } from "./commit";

export interface Reference {
  name: string;
  // A reference can point to a commit via its sha256
  // or it can point to a reference
  value: string;
}

export interface History<T extends { [k: string]: any }> {
  original: T;
  refs: Map<string, Reference>;
  commits: Commit[];
}
