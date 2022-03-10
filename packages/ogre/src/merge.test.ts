import test from 'ava'
import {getBaseline, testAuthor} from './test.utils'

test('merge with no commit fails', async t => {
  const [repo] = await getBaseline()
  repo.data.name = 'new name'
  await repo.commit('simple change', testAuthor)

  repo.createBranch('new_feature')

  t.throws(() => {
    repo.merge('new_feature')
  }, { message: 'already up to date'})
})

test('merge fast-forward', async t => {
  const [repo] = await getBaseline()
  repo.data.name = 'new name'
  await repo.commit('simple change', testAuthor)
  const masterCommitCount = repo.getHistory().commits.length

  repo.checkout('new_branch', true)
  repo.data.name = 'another name'
  const minorHash = await repo.commit('minor change', testAuthor)
  t.is(repo.head(), 'refs/heads/new_branch', 'HEAD not pointing to new_branch')
  t.is(repo.ref('refs/heads/new_branch'), minorHash, 'branch did not move to new commit')

  // go to destination branch
  repo.checkout('main')
  const mergeHash = repo.merge('new_branch')
  const headRef = repo.head()
  const refHash = repo.ref(headRef)

  t.is(mergeHash, minorHash, 'did not fast-forward to expected commit')
  t.is(refHash, mergeHash, `master is not at expected commit`)
  t.is(repo.getHistory().commits.length, masterCommitCount+1, 'fast-forward failed, superfluous commit detected')

})
