import test from 'ava'
import { addOneStep, getBaseline, testAuthor, updateHeaderData } from './test.utils'
import { Repository } from './repository'
import { templates } from 'proto/lib/lumen'
import ProcessTemplate = templates.ProcessTemplate

test('baseline with 1 commit and zero changelog entries', async t => {
  const [ repo ] = await getBaseline()

  const history = repo.getHistory()
  t.is(history.changeLog.length, 0, 'has changelog entries')
  t.is(history.commits.length, 0, 'incorrect # of commits')
})

test('head points to nothing', async t => {
  const template = new ProcessTemplate()
  const repo = new Repository<ProcessTemplate>(template, { TCreator: ProcessTemplate })

  t.is(repo.head(), undefined, 'head should point to nothing')
})

test('no commit without changes', async t => {
  const template = new ProcessTemplate()
  const repo = new Repository<ProcessTemplate>(template, { TCreator: ProcessTemplate })

  t.is(repo.head(), undefined, 'head should point to nothing')

  await t.throwsAsync(async () => {
    return await repo.commit('baseline', testAuthor)
  }, { message: 'no changes to commit' })

  t.is(repo.head(), undefined, 'head should point to nothing')
})

test('no commit without changes after recent commit', async t => {
  const template = new ProcessTemplate()
  const repo = new Repository<ProcessTemplate>(template, { TCreator: ProcessTemplate })

  t.is(repo.head(), undefined, 'head should point to nothing')
  repo.data.name = 'new name'
  await repo.commit('baseline', testAuthor)

  await t.throwsAsync(async () => {
    return await repo.commit('baseline', testAuthor)
  }, { message: 'no changes to commit' })
})

test('head moves to recent commit', async t => {
  const template = new ProcessTemplate()
  const repo = new Repository<ProcessTemplate>(template, { TCreator: ProcessTemplate })

  t.is(repo.head(), undefined, 'head should point to nothing')
  repo.data.name = 'new name'
  const hash = await repo.commit('baseline', testAuthor)
  const head = repo.head()
  t.not(head, undefined, 'head should be a commit')
  t.is (repo.head()?.hash, hash, 'head does not point to recent commit')
})

test('two commits with 3 changes', async t => {
  const [ repo, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  await repo.commit('header data', testAuthor)

  const history = repo.getHistory()
  t.is(history.changeLog.length, 3, 'incorrect # of changelog entries')
  t.is(history.commits.length, 1, 'incorrect # of commits')
})

test('array push double-change, 6 changes, 3 commits', async t => {
  const [ repo, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  await repo.commit('header data', testAuthor)

  addOneStep(wrapped)
  await repo.commit('first step', testAuthor)

  const history = repo.getHistory()
  t.is(history.changeLog.length, 6, 'incorrect # of changelog entries')
  t.is(history.commits.length, 2, 'incorrect # of commits')
  t.is(history.commits[0].changes.length, 3, '#incorrect # of changes in commit#1')
  t.is(history.commits[1].changes.length, 3, '#incorrect # of changes in commit#2')
})
test.todo('commit --amend')
