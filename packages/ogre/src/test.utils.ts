import { v4 as uuid4 } from "uuid";
import { Repository, RepositoryObject } from "./repository";
import { Commit } from "./commit";

export type NestedObject = {
  name?: string;
  uuid?: string;
};

export type ComplexObject = {
  uuid?: string;
  name?: string;
  description?: string;
  nested: NestedObject[];
};

export const testAuthor = "User name <name@domain.com>";

export async function getBaseline(
  obj?: Partial<ComplexObject>,
): Promise<[RepositoryObject<ComplexObject>, ComplexObject]> {
  const co: ComplexObject = {
    uuid: undefined,
    name: undefined,
    description: undefined,
    nested: [],
    ...obj,
  };
  const repo = new Repository(co, {});
  return [repo, co];
}

export function updateHeaderData(wrapped: ComplexObject) {
  wrapped.uuid = uuid4();
  wrapped.name = "my first process template";
  wrapped.description = "now we have a description";

  return 3; // change entries
}

export function addOneStep(wrapped: ComplexObject) {
  const pe: NestedObject = {};
  pe.uuid = uuid4();
  pe.name = "first name";

  wrapped.nested.push(pe);
  wrapped.nested[0].name = "new name";

  return 1; // change entries
}

export function sumChanges(commits: Commit[] | undefined) {
  return commits?.map((c) => c.changes.length).reduce((p, c) => p + c, 0);
}
