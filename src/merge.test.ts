import test from 'ava'
import { addOneStep, getBaseline, testAuthor, updateHeaderData } from './test.utils'
import { Repository } from './repository'
import { templates } from 'proto/lib/lumen'
import ProcessTemplate = templates.ProcessTemplate

test('merge with no commit', t => {
  const master = new Repository(new ProcessTemplate(), {TCreator: ProcessTemplate})
  const [newBranch] = master.branch()
  t.throws(() => {
    master.merge(newBranch)
  }, { message: 'nothing to merge'})
})

test('merge with no diff', async t => {
  const [ master, wrappedObject ] = await getBaseline()

  updateHeaderData(wrappedObject)
  await master.commit('header data', testAuthor)

  addOneStep(wrappedObject)
  await master.commit('first step', testAuthor)
  const head = master.head()?.hash

  // create new branch
  const [newBranch] = master.branch()
  t.is(newBranch.getHistory()?.changeLog.length, 6, 'new branch w/ incorrect # of changlog')

  t.throws(() => {
    // merge in master branch from new branch
    master.merge(newBranch)
  }, {message: `already at commit: ${head}`})
})

test('merge fast-forward with empty master', async t => {
  const master = new Repository(new ProcessTemplate(), {TCreator: ProcessTemplate})
  const masterCommitCount = master.getHistory().commits.length

  const [newBranch] = master.branch()
  const history = newBranch.getHistory()
  t.is(history?.changeLog.length, 0, 'new branch w/ incorrect # of changelog entries')

  newBranch.data.name = "name changed"
  newBranch.data.description = "description changed"
  const newHead = await newBranch.commit('description changes', testAuthor)

  t.is(master.head(), undefined, 'master head is not undefined')

  t.notThrows(() => {
    const mergeHash = master.merge(newBranch)
    t.is(mergeHash, newHead, 'did not fast-forward to expected commit')
    t.is(master.head()?.hash, mergeHash, `head@master is not the expected commit`)
    t.is(master.getHistory().commits.length, masterCommitCount+1, 'fast-forward failed, superfluous commit detected')
  }, 'threw unexpected error')
})

test('merge fast-forward', async t => {
  const [ master, wrappedObject ] = await getBaseline()
  updateHeaderData(wrappedObject)
  await master.commit('header data', testAuthor)
  addOneStep(wrappedObject)
  await master.commit('first step', testAuthor)

  const masterCommitCount = master.getHistory().commits.length

  // create new branch
  const [newBranch, wrappedObject2] = master.branch()
  const history = newBranch.getHistory()
  t.is(history?.changeLog.length, 6, 'new branch w/ incorrect # of changelog entries')

  // commit to new branch
  wrappedObject2.isPublic = true
  wrappedObject2.name = 'new name was necessary'
  const newHead = await newBranch.commit('new name for public use', testAuthor)

  t.notThrows(() => {
    // merge in master branch from new branch
    const mergeHash = master.merge(newBranch)

    t.is(mergeHash, newHead, 'did not fast-forward to expected commit')
    t.is(master.head()?.hash, mergeHash, `head is not the expected commit`)
    t.is(master.getHistory().commits.length, masterCommitCount+1, 'fast-forward failed, superfluous commit detected')
  }, 'threw unexpected error during merge')
})
