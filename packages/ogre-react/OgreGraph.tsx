import React, { useEffect, useState } from "react";

import { formatGit2Json, RepositoryObject } from "@dotinc/ogre";
import {
  type CommitOptions,
  Gitgraph,
  type TemplateName,
  type Orientation,
  type Mode,
} from "@gitgraph/react";
import type { Template } from "@gitgraph/core/lib/template";

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

export interface OgreGraphProps {
  repository: RepositoryObject<any>;
  options?: GitgraphOptions;
  commitOptions?: Map<string, CommitOptions>;
}

export const OgreGraph: React.FC<OgreGraphProps> = ({
  repository,
  options,
  commitOptions,
}) => {
  const [graphData, setGraphData] = useState<any[] | undefined>(undefined);

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

  return !graphData ? null : (
    <Gitgraph options={options}>
      {(gitgraph) => {
        gitgraph.import(graphData);
      }}
    </Gitgraph>
  );
};
