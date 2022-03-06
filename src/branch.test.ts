import test from 'ava'
import { getBaseline, testAuthor } from './test.utils'


test('current branch on empty repo is HEAD', async t => {
  const [repo] = await getBaseline()

  t.is(repo.branch(), 'HEAD', 'invalid current branch')
})

test('first commit goes onto default \'main\' branch', async t => {
  const [repo] = await getBaseline()
  repo.data.name = 'new name'
  await repo.commit('initial commit', testAuthor)

  t.is(repo.branch(), 'main', 'invalid current branch')
  t.is(repo.head(), 'refs/heads/main', 'invalid HEAD')
})

test('fails to create a branch name without commits', async t => {
  const [ repo ] = await getBaseline()

  t.throws(() => {
    repo.createBranch('new_feature')
  }, {message: 'fatal: not a valid object name: \'main\''})
})

test('creating a valid branch on a baseline', async t => {
  const [ repo ] = await getBaseline()
  repo.data.name = 'new name'
  const commit = await repo.commit('simple change', testAuthor)
  const ref = repo.createBranch('new_feature')
  t.is(ref, 'refs/heads/new_feature', 'invalid branch ref created')
  t.is(repo.ref(ref), commit, 'new branch is pointing to wrong commit')
})

test('cannot create new branch with invalid name', async t => {
  const [ repo ] = await getBaseline()

  for (const name of ['', '-foo', 'HEAD']) {
    t.throws(() => {
      repo.createBranch(name)
    }, {message: 'invalid ref name'})
  }
})
