import test from 'ava'
import { addOneStep, getBaseline, updateHeaderData } from './test.utils'

const testAuthor = 'User name <name@domain.com>'

test('baseline with 1 commit and zero changelog entries', async t => {
  const [ repo ] = await getBaseline()

  const history = repo.getHistory()
  t.is(history.changeLog.length, 0, 'has changelog entries')
  t.is(history.commits.length, 1, 'incorrect # of commits')
  t.is(repo.getVersion(), 0, 'incorrect version')
})

test('two commits with 3 changes', async t => {
  const [ repo, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  await repo.commit('header data', testAuthor)

  const history = repo.getHistory()
  t.is(history.changeLog.length, 3, 'incorrect # of changelog entries')
  t.is(history.commits.length, 2, 'incorrect # of commits')
  t.is(repo.getVersion(), 3, 'incorrect version')
})

test('array push double-change, 6 changes, 3 commits', async t => {
  const [ repo, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  await repo.commit('header data', testAuthor)

  addOneStep(wrapped)
  await repo.commit('first step', testAuthor)

  const history = repo.getHistory()
  t.is(history.changeLog.length, 6, 'incorrect # of changelog entries')
  t.is(history.commits.length, 3, 'incorrect # of commits')
  t.is(repo.getVersion(), 6, 'incorrect version')
})
test.todo('commit --amend')
