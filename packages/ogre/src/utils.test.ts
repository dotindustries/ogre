import test from 'ava'
import {cleanAuthor} from './utils'

test('author <email@domain.info>', t => {
  const [name, email] = cleanAuthor('author <email@domain.info>')
  t.is(name, 'author')
  t.is(email, 'email@domain.info')
})

test('author with space <email@domain.info>', t => {
  const [name, email] = cleanAuthor('author with space <email@domain.info>')
  t.is(name, 'author with space')
  t.is(email, 'email@domain.info')
})

test('author @handle', t => {
  const [name, email] = cleanAuthor('author @handle')
  t.is(name, 'author')
  t.is(email, '@handle')
})

test('author with space @handle', t => {
  const [name, email] = cleanAuthor('author with space @handle')
  t.is(name, 'author with space')
  t.is(email, '@handle')
})

test('email@domain.info', t => {
  const [name, email] = cleanAuthor('email@domain.info')
  t.is(name, '')
  t.is(email, 'email@domain.info')
})

test('@handle', t => {
  const [name, email] = cleanAuthor('@handle')
  t.is(name, '@handle')
  t.is(email, '')
})

test('empty author', t => {
  t.throws(() => {
    cleanAuthor('')
  }, {message: 'author not provided'})
})
