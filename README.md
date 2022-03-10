# ogre

An in-memory git-like repository for objects for when you need to 
keep the history around for a bit longer.

[![codecov](https://codecov.io/gh/dotindustries/ogre/branch/main/graph/badge.svg?token=23M014CWLK)](https://codecov.io/gh/dotindustries/ogre) [![Test coverage](https://github.com/dotindustries/ogre/actions/workflows/coverage.yml/badge.svg)](https://github.com/dotindustries/ogre/actions/workflows/coverage.yml)

## Features

- Commit
- Branch
- Checkout
- Merge
    - fast-forward

## Usage

```typescript
const repo = new Repository(new ComplexObject())

// apply changes
repo.data.name = 'my name'
repo.data.description = 'now we have a description'

// commit changes 
const init = await repo.commit('initial commit', 'author <author@test.com>')
repo.createBranch('savepoint')

// start a branch
repo.checkout('add_details', true)

// apply changes
repo.data.name = 'a fancier name'

// a) commit & merge
  await repo.commit('change name', 'author <author@test.com>')
  repo.checkout('main')
  repo.merge('add_details')

// or b) discard change and go back
  // by using the branch name 
  repo.checkout('main') // or repo.checkout('savepoint')
  // by using the commit hash in a detached state
  repo.checkout(init)
```

## TODO

- [ ] Visualization
- [ ] Merge
    - [ ] recursive
    - [ ] octopus
