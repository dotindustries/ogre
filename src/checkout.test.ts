import test from 'ava'
import { addOneStep, getBaseline, sumChanges, testAuthor, updateHeaderData } from './test.utils'

test('checkout prev commit', async t => {
  const [ repo, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  const headerDataHash = await repo.commit('header data', testAuthor)

  addOneStep(wrapped)
  await repo.commit('first step', testAuthor)

  repo.checkout(headerDataHash)
  const head = repo.head()
  const history = repo.getHistory()
  t.is(sumChanges(history.commits), 3, `incorrect # of changelog entries`)
  t.is(history.commits.length, 1, 'incorrect # of commits')
  t.is(head, headerDataHash, `points to wrong commit`)
  t.is(repo.branch(), 'HEAD', 'repo is not in detached state')
})

test('checkout new branch with simple name', async t => {
  const [ repo ] = await getBaseline()
  repo.data.name = 'new name'
  await repo.commit('simple change', testAuthor)

  const ref = repo.createBranch('new_feature')
  repo.checkout('new_feature')
  t.is(repo.head(), ref, 'head is not moved to target branch')
})

test('checkout new branch with full ref name', async t => {
  const [ repo ] = await getBaseline()
  repo.data.name = 'new name'
  await repo.commit('simple change', testAuthor)

  const ref = repo.createBranch('new_feature')
  repo.checkout(ref)
  t.is(repo.head(), ref, 'head is not moved to target branch')
})

test('checkout commit which has two refs pointing leaves HEAD detached', async t => {
  const [ repo ] = await getBaseline()
  repo.data.name = 'new name'
  const commit = await repo.commit('simple change', testAuthor)

  repo.createBranch('new_feature')
  repo.checkout(commit)
  t.is(repo.branch(), 'HEAD', 'head is not detached at commit')
  t.is(repo.head(), commit, 'head is not pointing to commit')
})

test('checkout new branch moves head to new branch', async t => {
  const [ repo ] = await getBaseline()
  repo.data.name = 'new name'
  await repo.commit('simple change', testAuthor)

  const ref = repo.createBranch('new_feature')
  repo.checkout('new_feature')
  t.is(repo.head(), ref, 'head is not moved to target branch')
})

test('checkout and create new branch on empty main', async t => {
  const [repo] = await getBaseline()

  repo.checkout('new_feature', true)
  t.is(repo.head(), 'refs/heads/new_feature', 'head should point to empty branch')
  t.is(repo.branch(), 'HEAD', 'branch still should be empty')
})
