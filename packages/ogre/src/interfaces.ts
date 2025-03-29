import type {Commit} from "./commit.js";

export interface Reference {
  name: string;
  // A reference can point to a commit via its sha256
  // or it can point to a reference
  value: string;
}

export interface History {
  refs: Map<string, Reference>;
  commits: Commit[];
}
