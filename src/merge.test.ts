import test from 'ava'
import { addOneStep, getBaseline, updateHeaderData } from './test.utils'

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

test('merge with 1 commit diff', t => {
  const [ master, wrappedObject ] = getBaseline()

  updateHeaderData(wrappedObject)
  master.commit('header data')

  addOneStep(wrappedObject)
  master.commit('first step')

  // create new branch
  const [newBranch, wrappedObject2] = master.branch()
  t.is(newBranch.getHistory()?.changeLog.length, 6, 'new branch w/ incorrect # of changlog')

  // commit to new branch
  wrappedObject2.isPublic = true
  wrappedObject2.name = 'new name was necessary'
  const newHead = newBranch.commit('new name for public use')
  t.is(newBranch.getVersion(), master.getVersion() + 2, 'incorrect version #')

  t.notThrows(() => {
    // merge in master branch from new branch
    const mergeHash = master.merge(newBranch)

    // TODO verify master history, git log and changelog
  }, 'threw unexpected error during merge')
})
