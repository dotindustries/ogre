import React, { useEffect, useState } from "react";

import { formatGit2Json, RepositoryObject } from "@dotinc/ogre";
import { Gitgraph } from "@gitgraph/react";
import { GitgraphOptions } from "@gitgraph/core/src/gitgraph";

export interface OgreGraphProps {
  repository: RepositoryObject<any>;
  options: GitgraphOptions | undefined;
}

export const OgreGraph: React.FC<OgreGraphProps> = ({
  repository,
  options,
}) => {
  const [graphData, setGraphData] = useState<any[] | undefined>(undefined);

  useEffect(() => {
    if (!graphData) {
      const history = repository.getHistory();
      setGraphData(formatGit2Json(history));
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
