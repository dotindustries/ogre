import { v4 as uuid4 } from "uuid";
import { Repository, RepositoryObject } from "./repository";
import { Commit } from "./commit";

export class NestedObject {
  public name: string | undefined;
  public uuid: string | undefined;
}

export class ComplexObject {
  public uuid: string | undefined;
  public name: string | undefined;
  public description: string | undefined;
  public nested: NestedObject[] = [];
}

export const testAuthor = "User name <name@domain.com>";

export async function getBaseline(): Promise<
  [RepositoryObject<ComplexObject>, ComplexObject]
> {
  const co = new ComplexObject();
  const repo = new Repository(co, {});
  return [repo, repo.data];
}

export function updateHeaderData(wrapped: ComplexObject) {
  wrapped.uuid = uuid4();
  wrapped.name = "my first process template";
  wrapped.description = "now we have a description";

  return 3; // change entries
}

export function addOneStep(wrapped: ComplexObject) {
  const pe = new NestedObject();
  pe.uuid = uuid4();
  pe.name = "first name";

  wrapped.nested.push(pe);
  wrapped.nested[0].name = "new name";

  return 3; // change entries
}

export function sumChanges(commits: Commit[] | undefined) {
  return commits?.map((c) => c.changes.length).reduce((p, c) => p + c, 0);
}
