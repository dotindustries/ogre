import test from 'ava'
import {ComplexObject, getBaseline, sumChanges, testAuthor} from './test.utils'
import {Repository} from './repository'

test('merge with no commit fails', async t => {
  const [repo] = await getBaseline()
  repo.data.name = 'new name'
  await repo.commit('simple change', testAuthor)

  repo.createBranch('new_feature')

  t.throws(() => {
    repo.merge('new_feature')
  }, { message: 'already up to date'})
})

test.failing('merge fast-forward with empty master', async t => {
  const repo = new Repository(new ComplexObject(), {})
  const masterCommitCount = repo.getHistory().commits.length

  // replacing default main branch by moving HEAD to new branch even on empty repo is OK
  repo.checkout('new_feature', true)
  const history = repo.getHistory()
  t.is(sumChanges(history?.commits), 0, 'new branch w/ incorrect # of changelog entries')

  repo.data.name = "name changed"
  repo.data.description = "description changed"
  const newHead = await repo.commit('description changes', testAuthor)

  t.throws(() => {
    // TODO: should throw an error, as this branch never existed in the first place?
    repo.checkout('main')
  }, {message: 'does not exists ... check git error explicitly'})

  t.notThrows(() => {
    const mergeHash = repo.merge('newBranch')
    const headRef = repo.head()
    const refHash = repo.ref(headRef)

    t.is(mergeHash, newHead, 'did not fast-forward to expected commit')
    t.is(refHash, mergeHash, `head@master is not the expected commit`)
    t.is(repo.getHistory().commits.length, masterCommitCount+1, 'fast-forward failed, superfluous commit detected')
  }, 'threw unexpected error')
})

// test.failing('merge fast-forward', async t => {
//   const [ master, wrappedObject ] = await getBaseline()
//   updateHeaderData(wrappedObject)
//   await master.commit('header data', testAuthor)
//   addOneStep(wrappedObject)
//   await master.commit('first step', testAuthor)
//
//   const masterCommitCount = master.getHistory().commits.length
//
//   // create new branch
//   const [newBranch, wrappedObject2] = master.createBranch('new_feature')
//   const history = newBranch.getHistory()
//   t.is(history?.commits.length, 2, )
//   t.is(sumChanges(history?.commits), 6, 'new branch w/ incorrect # of changelog entries')
//
//   // commit to new branch
//   wrappedObject2.isPublic = true
//   wrappedObject2.name = 'new name was necessary'
//   const newHead = await newBranch.commit('new name for public use', testAuthor)
//
//   t.notThrows(() => {
//     // merge in master branch from new branch
//     const mergeHash = master.merge(newBranch)
//     const headRef = master.head()
//     const refHash = master.ref(headRef)
//
//     t.is(mergeHash, newHead, 'did not fast-forward to expected commit')
//     t.is(refHash, mergeHash, `head '${headRef}' is not the expected commit`)
//     t.is(master.getHistory().commits.length, masterCommitCount+1, 'fast-forward failed, superfluous commit detected')
//   }, 'threw unexpected error during merge')
// })
