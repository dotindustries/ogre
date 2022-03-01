import test from 'ava'
import { addOneStep, getBaseline, updateHeaderData } from './test.utils'
import { VersionControlled } from './versionControlled'
import { templates } from 'proto/lib/lumen'
import ProcessTemplate = templates.ProcessTemplate

test('merge with no commit', t => {
  const master = new VersionControlled(new ProcessTemplate(), {TCreator: ProcessTemplate})
  const [newBranch] = master.branch()
  t.throws(() => {
    master.merge(newBranch)
  }, { message: 'nothing to merge'})
})

test('merge with no diff', t => {
  const [ master, wrappedObject ] = getBaseline()

  updateHeaderData(wrappedObject)
  master.commit('header data')

  addOneStep(wrappedObject)
  master.commit('first step')
  const head = master.head()?.hash

  // create new branch
  const [newBranch] = master.branch()
  t.is(newBranch.getHistory()?.changeLog.length, 6, 'new branch w/ incorrect # of changlog')

  t.throws(() => {
    // merge in master branch from new branch
    master.merge(newBranch)
  }, {message: `already at commit: ${head}`})
})

test('merge fast-forward with empty master', t => {
  const master = new VersionControlled(new ProcessTemplate(), {TCreator: ProcessTemplate})
  const masterCommitCount = master.getHistory().commits.length

  const [newBranch] = master.branch()
  const history = newBranch.getHistory()
  t.is(history?.changeLog.length, 0, 'new branch w/ incorrect # of changelog entries')

  newBranch.data.name = "name changed"
  newBranch.data.description = "description changed"
  const newHead = newBranch.commit('description changes')

  t.is(master.head(), undefined, 'master head is not undefined')

  t.notThrows(() => {
    const mergeHash = master.merge(newBranch)
    t.is(mergeHash, newHead, 'did not fast-forward to expected commit')
    t.is(master.head()?.hash, mergeHash, `head@master is not the expected commit`)
    t.is(master.getHistory().commits.length, masterCommitCount+1, 'fast-forward failed, superfluous commit detected')
    t.is(master.getVersion(), 2, 'incorrect version after merge')
  }, 'threw unexpected error')
})

test('merge fast-forward', t => {
  const [ master, wrappedObject ] = getBaseline()
  updateHeaderData(wrappedObject)
  master.commit('header data')
  addOneStep(wrappedObject)
  master.commit('first step')

  const masterCommitCount = master.getHistory().commits.length

  // create new branch
  const [newBranch, wrappedObject2] = master.branch()
  const history = newBranch.getHistory()
  t.is(history?.changeLog.length, 6, 'new branch w/ incorrect # of changelog entries')

  // commit to new branch
  wrappedObject2.isPublic = true
  wrappedObject2.name = 'new name was necessary'
  const newHead = newBranch.commit('new name for public use')
  t.is(newBranch.getVersion(), master.getVersion() + 2, 'incorrect version #')

  t.notThrows(() => {
    // merge in master branch from new branch
    const mergeHash = master.merge(newBranch)

    t.is(mergeHash, newHead, 'did not fast-forward to expected commit')
    t.is(master.head()?.hash, mergeHash, `head@master is not the expected commit`)
    t.is(master.getHistory().commits.length, masterCommitCount+1, 'fast-forward failed, superfluous commit detected')
  }, 'threw unexpected error during merge')
})
