import test from 'ava'
import { addOneStep, getBaseline, updateHeaderData } from './test.utils'

test('baseline with 1 commit and zero changelog entries', t => {
  const [ vc ] = getBaseline()

  const history = vc.getHistory()
  t.is(history.changeLog.length, 0, 'has changelog entries')
  t.is(history.commits.length, 1, 'incorrect # of commits')
  t.is(vc.getVersion(), 0, 'incorrect version')
})

test('two commits with 3 changes', t => {
  const [ vc, wrapped ] = getBaseline()

  updateHeaderData(wrapped)
  vc.commit('header data')

  const history = vc.getHistory()
  t.is(history.changeLog.length, 3, 'incorrect # of changelog entries')
  t.is(history.commits.length, 2, 'incorrect # of commits')
  t.is(vc.getVersion(), 3, 'incorrect version')
})

test('array push double-change, 6 changes, 3 commits', t => {
  const [ vc, wrapped ] = getBaseline()

  updateHeaderData(wrapped)
  vc.commit('header data')

  addOneStep(wrapped)
  vc.commit('first step')

  const history = vc.getHistory()
  t.is(history.changeLog.length, 6, 'incorrect # of changelog entries')
  t.is(history.commits.length, 3, 'incorrect # of commits')
  t.is(vc.getVersion(), 6, 'incorrect version')
})
test.todo('commit --amend')
