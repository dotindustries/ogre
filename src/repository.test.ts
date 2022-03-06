import test from 'ava'
import { Repository } from './repository'
import { addOneStep, getBaseline, sumChanges, testAuthor, updateHeaderData } from './test.utils'
import { templates } from 'proto/lib/lumen'
import ProcessTemplate = templates.ProcessTemplate

test('reconstruction', async t => {
  const [ repo, wrapped ] = await getBaseline()

  updateHeaderData(wrapped)
  await repo.commit('header data', testAuthor)

  addOneStep(wrapped)
  await repo.commit('first step', testAuthor)

  // start reconstruction
  const p = new ProcessTemplate()
  const repo2 = new Repository(p, { history: repo.getHistory() })

  const history = repo2.getHistory()
  t.is(sumChanges(history.commits), 6, 'incorrect # of changelog entries')
  t.is(history.commits.length, 2, 'incorrect # of commits')
})
