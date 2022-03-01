import { templates } from 'proto/lib/lumen'
import ProcessTemplate = templates.ProcessTemplate
import ProcessStep = templates.ProcessStep
import ProcessElement = templates.ProcessElement
import { v4 as uuid4 } from 'uuid'
import { VersionControlled, VersionControlledObject } from './versionControlled'

export function getBaseline(): [VersionControlledObject<ProcessTemplate>, ProcessTemplate, string] {
  const template = new ProcessTemplate()
  const vc = new VersionControlled<ProcessTemplate>(template, { TCreator: ProcessTemplate })
  const wrapped = vc.data
  const hash = vc.commit('baseline')
  return [vc, wrapped, hash]
}

export function updateHeaderData(wrapped: templates.ProcessTemplate) {
  wrapped.name = 'my first process template'
  wrapped.description = 'now we have a description'
  wrapped.uuid = uuid4()
}

export function addOneStep(wrapped: templates.ProcessTemplate) {
  const pe = new ProcessElement()
  pe.step = new ProcessStep()
  pe.step.uuid = uuid4()
  pe.step.name = 'first step name'

  wrapped.process.push(pe)
  wrapped.process[0].step!.name = 'new name'
}
