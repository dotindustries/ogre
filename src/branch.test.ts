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

test.todo('checkout new branch moves head to new branch')
test.todo('commit on new branch does not move main ref')
