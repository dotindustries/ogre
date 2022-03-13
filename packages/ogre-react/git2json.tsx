import {cleanAuthor, Commit, createHeadRefValue, History, isTagRef, Reference, REFS_HEAD_KEY} from '@dotinc/ogre'

const findRefs = (commit: Commit, refs: Map<string, Reference>) => {
  const list = []
  const headRef = refs.get(REFS_HEAD_KEY)
  for (const [key, ref] of refs.entries()) {
    if (ref.value === commit.hash) {
      if (isTagRef(key)) {
        list.push(`tag: ${ref.name}`)
      } else {
        list.push(ref.name)
      }
      // also check if HEAD is pointing to this ref
      if (headRef && headRef.value === createHeadRefValue(key)) {
        list.push(headRef.name)
      }
    }
  }
  return list
}
// format
export const formatGit2Json = (history: History) => {
  const {commits, refs} = history
  return commits.reverse().map(c => {
    const [name, email] = cleanAuthor(c.author)

    return {
      'refs': findRefs(c, refs),
      'hash': c.hash,
      'hashAbbrev': c.hash.substring(0, 8),
      'tree': c.tree,
      'treeAbbrev': c.tree.substring(0, 8),
      // FIXME there is only one parent at the moment on ogre
      'parents': c.parent ? [c.parent] : [],
      'parentsAbbrev': c.parent ? [c.parent.substring(0, 8)] : [],
      committer: {
        name,
        email,
        date: c.timestamp.getMilliseconds()
      },
      author: {
        name,
        email,
        timestamp: c.timestamp.getMilliseconds()
      },
      'subject': c.message,
      'body': '',
      'notes': '',
      // MAYBE? map changes to {additions: number, deletions: number, file: string}
      'stats': []
    }
  })
}
