import test from 'ava'
import { v4 as uuid4 } from 'uuid'
import { VersionControlled } from './versionControlled'
import { templates } from 'proto/lib/lumen'
import ProcessTemplate = templates.ProcessTemplate
import ProcessStep = templates.ProcessStep
import ProcessElement = templates.ProcessElement

function getBaseline() {
  const template = new ProcessTemplate()
  const vc = new VersionControlled<ProcessTemplate>(template, {TCreator: ProcessTemplate})
  const wrapped = vc.data
  const hash = vc.commit('baseline')
  return { vc, wrapped, hash }
}

test('baseline with 1 commit and zero changelog entries', t => {
  const { vc } = getBaseline()

  const history = vc.getHistory()
  t.is(history.changeLog.length, 0, 'has changelog entries')
  t.is(history.commits.length, 1, 'incorrect # of commits')
  t.is(vc.getVersion(), 0, 'incorrect version')
})

function updateHeaderData(wrapped: templates.ProcessTemplate) {
  wrapped.name = 'my first process template'
  wrapped.description = 'now we have a description'
  wrapped.uuid = uuid4()
}

function addOneStep(wrapped: templates.ProcessTemplate) {
  const pe = new ProcessElement()
  pe.step = new ProcessStep()
  pe.step.uuid = uuid4()
  pe.step.name = 'first step name'

  wrapped.process.push(pe)
  wrapped.process[0].step!.name = 'new name'
}

test('two commits with 3 changes', t => {
  const { vc, wrapped } = getBaseline()

  updateHeaderData(wrapped)
  vc.commit('header data')

  const history = vc.getHistory()
  t.is(history.changeLog.length, 3, 'incorrect # of changelog entries')
  t.is(history.commits.length, 2, 'incorrect # of commits')
  t.is(vc.getVersion(), 3, 'incorrect version')
})

test('array push double-change, 6 changes, 3 commits', t => {
  const { vc, wrapped } = getBaseline()

  updateHeaderData(wrapped)
  vc.commit('header data')

  addOneStep(wrapped)
  vc.commit('first step')

  const history = vc.getHistory()
  t.is(history.changeLog.length, 6, 'incorrect # of changelog entries')
  t.is(history.commits.length, 3, 'incorrect # of commits')
  t.is(vc.getVersion(), 6, 'incorrect version')
})

test('reconstruction', t => {
  const { vc, wrapped } = getBaseline()

  updateHeaderData(wrapped)
  vc.commit('header data')

  addOneStep(wrapped)
  vc.commit('first step')

  // start reconstruction
  const p = new ProcessTemplate()
  const vc2 = new VersionControlled(p, {history: vc.getHistory()})

  const history = vc2.getHistory()
  t.is(history.changeLog.length, 6, 'incorrect # of changelog entries')
  t.is(history.commits.length, 3, 'incorrect # of commits')
  t.is(vc2.getVersion(), 6, 'incorrect version')
})

test('merge with 1 commit diff', t => {
  const { vc: master, wrapped: wrappedObject } = getBaseline()

  updateHeaderData(wrappedObject)
  master.commit('header data')

  addOneStep(wrappedObject)
  master.commit('first step')

  // create new branch
  const [newBranch] = master.branch()
  t.is(newBranch.getHistory()?.changeLog.length, 6, 'new branch w/ incorrect # of changlog')

  // TODO commit to new branch

  // TODO merge in master branch from new branch

  // TODO verify master history, git log and changelog
})

test('rewind to header commit', t => {
  const { vc, wrapped } = getBaseline()

  updateHeaderData(wrapped)
  const headerHash = vc.commit('header data')

  addOneStep(wrapped)
  vc.commit('first step')

  vc.checkout(headerHash)

  const history = vc.getHistory()
  t.is(
    history.changeLog.length,
    3,
    `incorrect # of changelog entries: ${JSON.stringify(
      history.changeLog,
      null,
      '  '
    )}`
  )
  t.is(history.commits.length, 2, 'incorrect # of commits')
  const head = vc.head()
  t.is(
    head?.hash,
    headerHash,
    `we should be at header commit instead of: ${JSON.stringify(
      head,
      null,
      '  '
    )}`
  )
  t.is(
    vc.getVersion(),
    3,
    `wrong current version: ${JSON.stringify(
      head,
      null,
      '  '
    )} ${JSON.stringify(history.changeLog, null, '  ')}`
  )
})

test('rewind to v2 with no referenced commit', t => {
  const { vc, wrapped } = getBaseline()

  updateHeaderData(wrapped)
  vc.commit('header data')

  addOneStep(wrapped)
  vc.commit('first step')

  vc.gotoVersion(2)

  const history = vc.getHistory()
  t.is(
    history.changeLog.length,
    2,
    `incorrect # of changelog entries: ${JSON.stringify(
      history.changeLog,
      null,
      '  '
    )}`
  )
  t.is(history.commits.length, 1, 'incorrect # of commits')
  const head = vc.head()
  t.is(
    head,
    undefined,
    `was not supposed to find a commit for v2: ${JSON.stringify(
      head,
      null,
      '  '
    )}`
  )
  t.is(
    vc.getVersion(),
    2,
    `wrong current version: ${JSON.stringify(
      head,
      null,
      '  '
    )} ${JSON.stringify(history.changeLog, null, '  ')}`
  )
})
