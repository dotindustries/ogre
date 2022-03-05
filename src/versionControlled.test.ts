import test from 'ava'
import { VersionControlled } from './versionControlled'
import { addOneStep, getBaseline, updateHeaderData } from './test.utils'
import { templates } from 'proto/lib/lumen'
import ProcessTemplate = templates.ProcessTemplate

const testAuthor = 'User name <name@domain.com>'

test('reconstruction', async t => {
  const [ vc, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  await vc.commit('header data', testAuthor)

  addOneStep(wrapped)
  await vc.commit('first step', testAuthor)

  // start reconstruction
  const p = new ProcessTemplate()
  const vc2 = new VersionControlled(p, { history: vc.getHistory() })

  const history = vc2.getHistory()
  t.is(history.changeLog.length, 6, 'incorrect # of changelog entries')
  t.is(history.commits.length, 3, 'incorrect # of commits')
  t.is(vc2.getVersion(), 6, 'incorrect version')
})

test('rewind to header commit', async t => {
  const [ vc, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  const headerHash = await vc.commit('header data', testAuthor)

  addOneStep(wrapped)
  await vc.commit('first step', testAuthor)

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

test('rewind to v2 with no referenced commit', async t => {
  const [ vc, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  await vc.commit('header data', testAuthor)

  addOneStep(wrapped)
  await vc.commit('first step', testAuthor)

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
