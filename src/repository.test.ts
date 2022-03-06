import test from 'ava'
import { Repository } from './repository'
import { addOneStep, getBaseline, sumChanges, testAuthor, updateHeaderData } from './test.utils'
import { templates } from 'proto/lib/lumen'
import ProcessTemplate = templates.ProcessTemplate

test('reconstruction', async t => {
  const [ repo, wrapped ] = await getBaseline()

  let changeEntries = updateHeaderData(wrapped)
  const header = await repo.commit('header data', testAuthor)

  changeEntries += addOneStep(wrapped)
  const firstStep = await repo.commit('first step', testAuthor)

  console.log(`header commit: ${header}`)
  console.log(`firstStep commit: ${firstStep}`)
  const history = repo.getHistory()
  t.is(repo.head(), 'refs/heads/main', 'HEAD is wrong')
  t.is(repo.ref('refs/heads/main'), firstStep, 'main is pointing at wrong commit')
  t.is(history.commits.length, 2, 'incorrect # of commits')

  // start reconstruction
  const p = new ProcessTemplate()
  const repo2 = new Repository(p, { history })

  const history2 = repo2.getHistory()
  t.is(history2.commits.length, 2, 'incorrect # of commits')
  t.is(sumChanges(history2.commits), changeEntries, 'incorrect # of changelog entries')
})
