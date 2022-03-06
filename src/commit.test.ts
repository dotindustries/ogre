import test from 'ava'
import { addOneStep, getBaseline, sumChanges, testAuthor, updateHeaderData } from './test.utils'

test('baseline with 1 commit and zero changelog entries', async t => {
  const [ repo ] = await getBaseline()

  const history = repo.getHistory()
  t.is(sumChanges(history.commits), 0, 'has changelog entries')
  t.is(history.commits.length, 0, 'incorrect # of commits')
})

test('head points to main', async t => {
  const [repo] = await getBaseline()

  t.is(repo.head(), 'refs/heads/main', 'head not pointing where it should')
})

test('no commit without changes', async t => {
  const [repo] = await getBaseline()

  await t.throwsAsync(async () => {
    return await repo.commit('baseline', testAuthor)
  }, { message: 'no changes to commit' })
})

test('no commit without changes after recent commit', async t => {
  const [repo] = await getBaseline()
  repo.data.name = 'new name'
  await repo.commit('baseline', testAuthor)

  await t.throwsAsync(async () => {
    return await repo.commit('baseline', testAuthor)
  }, { message: 'no changes to commit' })
})
test('no commit --amend without commit', async t => {
  const [repo] = await getBaseline()
  repo.data.name = 'new name'

  await t.throwsAsync(async () => {
    return await repo.commit('baseline', testAuthor, true)
  }, { message: 'no commit to amend' })
})

test('main moves to recent commit', async t => {
  const [repo] = await getBaseline()
  repo.data.name = 'new name'
  const hash = await repo.commit('baseline', testAuthor)

  t.is (repo.ref('refs/heads/main'), hash, 'head does not point to recent commit')
})

test('two commits with 3 changes', async t => {
  const [ repo, wrapped ] = await getBaseline()
  updateHeaderData(wrapped)
  await repo.commit('header data', testAuthor)

  const history = repo.getHistory()
  t.is(sumChanges(history.commits), 3, 'incorrect # of changelog entries')
  t.is(history.commits.length, 1, 'incorrect # of commits')
})

test('array push double-change, 6 changes, 3 commits', async t => {
  const [ repo, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  await repo.commit('header data', testAuthor)

  addOneStep(wrapped)
  await repo.commit('first step', testAuthor)

  const history = repo.getHistory()
  t.is(sumChanges(history.commits), 6, 'incorrect # of changelog entries')
  t.is(history.commits.length, 2, 'incorrect # of commits')
  t.is(history.commits[0].changes.length, 3, '#incorrect # of changes in commit#1')
  t.is(history.commits[1].changes.length, 3, '#incorrect # of changes in commit#2')
})

test('all refs OK, when committing on new branch while main is empty main', async t => {
  const [repo] = await getBaseline()
  repo.checkout('new_feature', true)
  repo.data.name = 'new name'
  const commit = await repo.commit('simple change', testAuthor)

  t.is(repo.ref('refs/heads/main'), undefined, 'main should not point to a commit')
  t.is(repo.ref('refs/heads/new_feature'), commit, 'new_feature should point to last commit')
  t.is(repo.branch(), 'new_feature', 'branch should now be visible')
  t.is(repo.head(), 'refs/heads/new_feature', 'HEAD is pointing to wrong branch')
})

test('commit --amend changes hash on content change', async t => {
  const [repo] = await getBaseline()
  repo.data.name = 'new name'
  const commitToAmend = await repo.commit('name change', testAuthor)
  repo.data.description = 'new description'
  const changedHash = await repo.commit('name and description change', testAuthor, true)
  t.not(changedHash, commitToAmend, 'hash should have changed')
  const history = repo.getHistory()
  t.is(history.commits.length, 1, 'wrong # of commits')
  t.is(sumChanges(history.commits), 2, 'wrong # of changes')
  t.is(repo.head(), 'refs/heads/main', 'HEAD is not pointing to main')
  t.is(repo.branch(), 'main', 'we are on the wrong branch')
  t.is(repo.ref('refs/heads/main'), changedHash, 'main should point to changed commit hash')
})

test('commit --amend changes hash on message change', async t => {
  const [repo] = await getBaseline()
  repo.data.name = 'new name'
  const commitToAmend = await repo.commit('name change', testAuthor)
  const changedHash = await repo.commit('initial setup', testAuthor, true)
  t.not(changedHash, commitToAmend, 'hash should have changed')
  const history = repo.getHistory()
  t.is(history.commits.length, 1, 'wrong # of commits')
  t.is(sumChanges(history.commits), 1, 'wrong # of changes')
  t.is(repo.head(), 'refs/heads/main', 'HEAD is not pointing to main')
  t.is(repo.branch(), 'main', 'we are on the wrong branch')
  t.is(repo.ref('refs/heads/main'), changedHash, 'main should point to changed commit hash')
})
