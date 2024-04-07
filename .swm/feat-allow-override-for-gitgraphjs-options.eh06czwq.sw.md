---
title: 'feat: allow override for gitgraphjs options'
---
📦 Published PR as canary version:  ✨ Test out this PR locally via:

```bash
npm install @dotinc/ogre@0.10.0-canary.173.8587606058.0
npm install @dotinc/ogre-react@0.10.0-canary.173.8587606058.0
# or 
yarn add @dotinc/ogre@0.10.0-canary.173.8587606058.0
yarn add @dotinc/ogre-react@0.10.0-canary.173.8587606058.0
```

<SwmSnippet path="/packages/ogre-react/OgreGraph.tsx" line="12">

---

Include partial options from <SwmToken path="/packages/ogre-react/OgreGraph.tsx" pos="19:2:2" line-data="interface GitgraphOptions {">`GitgraphOptions`</SwmToken> and re-export template creation functions.

This extension includes an option for the graph to override commit level options as well by providing a map of <SwmToken path="/packages/ogre-react/OgreGraph.tsx" pos="34:1:1" line-data="  commitOptions?: Map&lt;string, CommitOptions&gt;;">`commitOptions`</SwmToken>

```tsx

export {
  templateExtend,
  metroTemplate,
  blackArrowTemplate,
} from "@gitgraph/core/lib/template";

interface GitgraphOptions {
  template?: TemplateName | Template;
  orientation?: Orientation;
  reverseArrow?: boolean;
  initCommitOffsetX?: number;
  initCommitOffsetY?: number;
  mode?: Mode;
  author?: string;
  branchLabelOnEveryCommit?: boolean;
  commitMessage?: string;
}
```

---

</SwmSnippet>

<SwmSnippet path="/packages/ogre-react/OgreGraph.tsx" line="43">

---

This is where the <SwmToken path="/packages/ogre-react/OgreGraph.tsx" pos="34:1:1" line-data="  commitOptions?: Map&lt;string, CommitOptions&gt;;">`commitOptions`</SwmToken> are applied to the repository commits.

```tsx

  useEffect(() => {
    if (!graphData) {
      const history = repository.getHistory();
      const data = formatGit2Json(history).map((c) => {
        const opts = commitOptions?.get(c.hash);
        return {
          ...c,
          ...(opts ? opts : {}),
        };
      });
      setGraphData(data);
    }
  }, [repository]);
```

---

</SwmSnippet>

<SwmSnippet path="/packages/ogre-react/OgreGraph.tsx" line="57">

---

Passing down the global options to Gitgraph.

```tsx

  return !graphData ? null : (
    <Gitgraph options={options}>
```

---

</SwmSnippet>

<SwmMeta version="3.0.0" repo-id="Z2l0aHViJTNBJTNBb2dyZSUzQSUzQWRvdGluZHVzdHJpZXM="><sup>Powered by [Swimm](https://app.swimm.io/)</sup></SwmMeta>
