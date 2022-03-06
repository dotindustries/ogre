import test from 'ava'
import { addOneStep, getBaseline, sumChanges, testAuthor, updateHeaderData } from './test.utils'

test('merge with no commit fails', async t => {
  const [repo] = await getBaseline()
  repo.data.name = 'new name'
  await repo.commit('simple change', testAuthor)

  repo.createBranch('new_feature')

  t.throws(() => {
    repo.merge('new_feature')
  }, { message: 'already up to date'})
})

// test.failing('merge with no diff', async t => {
//   const [ master, wrappedObject ] = await getBaseline()
//
//   updateHeaderData(wrappedObject)
//   await master.commit('header data', testAuthor)
//
//   addOneStep(wrappedObject)
//   await master.commit('first step', testAuthor)
//   const headRef = master.head()
//   const atCommit = master.ref(headRef)
//
//   // create new branch
//   const ref = master.createBranch('new_feature')
//   t.is(sumChanges(newBranch.getHistory()?.commits), 6, 'new branch w/ incorrect # of changlog')
//
//   t.throws(() => {
//     // merge in master branch from new branch
//     master.merge(newBranch)
//   }, {message: `already at commit: ${atCommit}`})
// })
//
// test.failing('merge fast-forward with empty master', async t => {
//   const master = new Repository(new ProcessTemplate(), {TCreator: ProcessTemplate})
//   const masterCommitCount = master.getHistory().commits.length
//
//   const [newBranch] = master.createBranch('new_feature')
//   const history = newBranch.getHistory()
//   t.is(sumChanges(history?.commits), 0, 'new branch w/ incorrect # of changelog entries')
//
//   newBranch.data.name = "name changed"
//   newBranch.data.description = "description changed"
//   const newHead = await newBranch.commit('description changes', testAuthor)
//
//
//   t.notThrows(() => {
//     const mergeHash = master.merge(newBranch)
//     const headRef = master.head()
//     const refHash = master.ref(headRef)
//
//     t.is(mergeHash, newHead, 'did not fast-forward to expected commit')
//     t.is(refHash, mergeHash, `head@master is not the expected commit`)
//     t.is(master.getHistory().commits.length, masterCommitCount+1, 'fast-forward failed, superfluous commit detected')
//   }, 'threw unexpected error')
// })
//
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
