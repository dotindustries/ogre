import test from 'ava'
import { Repository } from './repository'
import {addOneStep, ComplexObject, getBaseline, sumChanges, testAuthor, updateHeaderData} from './test.utils'

test('reconstruction', async t => {
  const [ repo, wrapped ] = await getBaseline()

  let changeEntries = updateHeaderData(wrapped)
  await repo.commit('header data', testAuthor)

  changeEntries += addOneStep(wrapped)
  const firstStep = await repo.commit('first step', testAuthor)

  const history = repo.getHistory()
  t.is(repo.head(), 'refs/heads/main', 'HEAD is wrong')
  t.is(repo.ref('refs/heads/main'), firstStep, 'main is pointing at wrong commit')
  t.is(history.commits.length, 2, 'incorrect # of commits')

  // start reconstruction
  const p = new ComplexObject()
  const repo2 = new Repository(p, { history })

  const history2 = repo2.getHistory()
  t.is(history2.commits.length, 2, 'incorrect # of commits')
  t.is(sumChanges(history2.commits), changeEntries, 'incorrect # of changelog entries')
})
