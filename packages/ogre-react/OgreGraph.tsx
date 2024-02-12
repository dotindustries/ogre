import React, { useEffect, useState } from "react";

import { formatGit2Json, RepositoryObject } from "@dotinc/ogre";
import { Gitgraph } from "@gitgraph/react";

export interface OgreGraphProps {
  repository: RepositoryObject<any>;
}

export const OgreGraph: React.FC<OgreGraphProps> = ({ repository }) => {
  const [graphData, setGraphData] = useState<any[] | undefined>(undefined);

  useEffect(() => {
    if (!graphData) {
      const history = repository.getHistory();
      setGraphData(formatGit2Json(history));
    }
  }, [repository]);

  return !graphData ? null : (
    <Gitgraph>
      {(gitgraph) => {
        gitgraph.import(graphData);
      }}
    </Gitgraph>
  );
};
