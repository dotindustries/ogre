import { Commit } from "./commit";
import { History, Reference } from "./interfaces";
import {
  cleanAuthor,
  createHeadRefValue,
  isTagRef,
  REFS_HEAD_KEY,
} from "./utils";

const findRefs = (commit: Commit, refs: Map<string, Reference>) => {
  const list = [];
  const headRef = refs.get(REFS_HEAD_KEY);
  for (const [key, ref] of refs.entries()) {
    if (ref.value === commit.hash) {
      if (isTagRef(key)) {
        list.push(`tag: ${ref.name}`);
      } else {
        list.push(ref.name);
      }
      // also check if HEAD is pointing to this ref
      if (headRef && headRef.value === createHeadRefValue(key)) {
        list.push(headRef.name);
      }
    }
  }
  return list;
};

/**
 * The function `formatGit2Json` takes a `history` object and returns an array of formatted commit
 * objects.
 * @param {History} history - The `history` parameter is an object that contains information about the
 * Repository history.
 * @returns The function `formatGit2Json` returns an array of objects. Each object represents a commit
 * in the Repository history. The json representation is returned in `git2json` format based on:
 * https://github.com/fabien0102/git2json/blob/e067166d2468018b6f3982a8fb44a2e54110ce02/src/git2json.js#L5-L22
 */
export const formatGit2Json = <T = any>(history: History) => {
  const { commits, refs } = history;
  return commits.reverse().map((c) => {
    const [name, email] = cleanAuthor(c.author);

    return {
      refs: findRefs(c, refs),
      hash: c.hash,
      hashAbbrev: c.hash.substring(0, 8),
      tree: c.tree,
      treeAbbrev: c.tree.substring(0, 8),
      // FIXME there is only one parent at the moment on ogre
      parents: c.parent ? [c.parent] : [],
      parentsAbbrev: c.parent ? [c.parent.substring(0, 8)] : [],
      committer: {
        name,
        email,
        date: c.timestamp.getMilliseconds(),
      },
      author: {
        name,
        email,
        timestamp: c.timestamp.getMilliseconds(),
      },
      subject: c.message,
      body: "",
      notes: "",
      // MAYBE? map changes to {additions: number, deletions: number, file: string}
      stats: [],
    };
  });
};
