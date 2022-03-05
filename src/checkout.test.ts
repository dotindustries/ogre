import test from 'ava'
import { addOneStep, getBaseline, testAuthor, updateHeaderData } from './test.utils'

test('checkout previous commit', async t => {
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
  t.is(history.commits.length, 1, 'incorrect # of commits')
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
})
