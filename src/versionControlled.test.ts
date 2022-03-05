import test from 'ava'
import { VersionControlled } from './versionControlled'
import { addOneStep, getBaseline, updateHeaderData } from './test.utils'
import { templates } from 'proto/lib/lumen'
import ProcessTemplate = templates.ProcessTemplate



test('reconstruction', t => {
  const [ vc, wrapped ] = getBaseline()

  updateHeaderData(wrapped)
  vc.commit('header data')

  addOneStep(wrapped)
  vc.commit('first step')

  // start reconstruction
  const p = new ProcessTemplate()
  const vc2 = new VersionControlled(p, { history: vc.getHistory() })

  const history = vc2.getHistory()
  t.is(history.changeLog.length, 6, 'incorrect # of changelog entries')
  t.is(history.commits.length, 3, 'incorrect # of commits')
  t.is(vc2.getVersion(), 6, 'incorrect version')
})

test('rewind to header commit', t => {
  const [ vc, wrapped ] = getBaseline()

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
  const [ vc, wrapped ] = getBaseline()

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
