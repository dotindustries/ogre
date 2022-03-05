import test from 'ava'
import { Repository } from './repository'
import { addOneStep, getBaseline, updateHeaderData } from './test.utils'
import { templates } from 'proto/lib/lumen'
import ProcessTemplate = templates.ProcessTemplate

const testAuthor = 'User name <name@domain.com>'

test('reconstruction', async t => {
  const [ repo, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  await repo.commit('header data', testAuthor)

  addOneStep(wrapped)
  await repo.commit('first step', testAuthor)

  // start reconstruction
  const p = new ProcessTemplate()
  const repo2 = new Repository(p, { history: repo.getHistory() })

  const history = repo2.getHistory()
  t.is(history.changeLog.length, 6, 'incorrect # of changelog entries')
  t.is(history.commits.length, 3, 'incorrect # of commits')
  t.is(repo2.getVersion(), 6, 'incorrect version')
})

test('rewind to header commit', async t => {
  const [ repo, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  const headerHash = await repo.commit('header data', testAuthor)

  addOneStep(wrapped)
  await repo.commit('first step', testAuthor)

  repo.checkout(headerHash)

  const history = repo.getHistory()
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
  const head = repo.head()
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
    repo.getVersion(),
    3,
    `wrong current version: ${JSON.stringify(
      head,
      null,
      '  '
    )} ${JSON.stringify(history.changeLog, null, '  ')}`
  )
})

test('rewind to v2 with no referenced commit', async t => {
  const [ repo, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  await repo.commit('header data', testAuthor)

  addOneStep(wrapped)
  await repo.commit('first step', testAuthor)

  repo.gotoVersion(2)

  const history = repo.getHistory()
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
  const head = repo.head()
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
    repo.getVersion(),
    2,
    `wrong current version: ${JSON.stringify(
      head,
      null,
      '  '
    )} ${JSON.stringify(history.changeLog, null, '  ')}`
  )
})
