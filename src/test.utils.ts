import { templates } from 'proto/lib/lumen'
import { v4 as uuid4 } from 'uuid'
import { Repository, RepositoryObject } from './repository'
import { Commit } from './commit'
import ProcessTemplate = templates.ProcessTemplate
import ProcessStep = templates.ProcessStep
import ProcessElement = templates.ProcessElement

export const testAuthor = 'User name <name@domain.com>'

export async function getBaseline(): Promise<[RepositoryObject<ProcessTemplate>, ProcessTemplate]> {
  const template = new ProcessTemplate()
  const repo = new Repository<ProcessTemplate>(template, {})
  const wrapped = repo.data
  return [repo, wrapped]
}

export function updateHeaderData(wrapped: templates.ProcessTemplate) {
  wrapped.name = 'my first process template'
  wrapped.description = 'now we have a description'
  wrapped.uuid = uuid4()

  return 3 // change entries
}

export function addOneStep(wrapped: templates.ProcessTemplate) {
  const pe = new ProcessElement()
  pe.step = new ProcessStep()
  pe.step.uuid = uuid4()
  pe.step.name = 'first step name'

  wrapped.process.push(pe)
  wrapped.process[0].step!.name = 'new name'

  return 3 // change entries
}

export function sumChanges(commits: Commit[] | undefined) {
  return commits?.map(c => c.changes.length).reduce((p, c) => p + c, 0)
}
