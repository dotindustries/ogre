import test from 'ava'
import { addOneStep, getBaseline, testAuthor, updateHeaderData } from './test.utils'

test('checkout prev commit', async t => {
  const [ repo, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  const headerDataHash = await repo.commit('header data', testAuthor)

  addOneStep(wrapped)
  await repo.commit('first step', testAuthor)

  repo.checkout(headerDataHash)
  const head = repo.head()
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
  t.is(head, headerDataHash, `points to wrong commit`)
  t.is(repo.branch(), 'HEAD', 'repo is not in detached state')
})
