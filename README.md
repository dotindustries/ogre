# ogre

An in-memory git-like repository for objects for when you need to
keep the history around for a bit longer. The library uses json-patch RFC6902 for representing diffs.

[![codecov](https://codecov.io/gh/dotindustries/ogre/branch/main/graph/badge.svg?token=23M014CWLK)](https://codecov.io/gh/dotindustries/ogre) [![Test coverage](https://github.com/dotindustries/ogre/actions/workflows/coverage.yml/badge.svg)](https://github.com/dotindustries/ogre/actions/workflows/coverage.yml)

## Features

- Commit
- Branch
- Tags
- Checkout
- Reset (soft and hard)
- Diff
- Status
- Apply
  > ⚠️ Currently with a workaround to adapt for setting a value for an undefined prop `{prop: undefined}` will result in
  the `compare` call as a `replace`
  operation, but will be recorded by the observer as an `add` operation.
  > Applying a patch like that will result in internal retry with `add` instead of `replace`.
  >
  > See https://github.com/Starcounter-Jack/JSON-Patch/issues/280 for details
- Visualization via `@dotinc/ogre-react`
- Merge
    - fast-forward

## Usage

```typescript
const repo = new Repository(new ComplexObject());

// apply changes
repo.data.name = "my name";
repo.data.description = "now we have a description";

// commit changes
const init = await repo.commit("initial commit", "author <author@test.com>");
// create a branch named savepoint pointing to the last commit
repo.createBranch("savepoint");

// switch to new branch
repo.checkout("add_details", true);

// apply changes
repo.data.name = "a fancier name";

// a) commit & merge
await repo.commit("change name", "author <author@test.com>");
repo.checkout("main");
repo.merge("add_details");
repo.tag("v1.0.0");

// or b) discard change and go back
// by using the branch name
repo.checkout("main");
// by using the commit hash in a detached state
repo.checkout(init);
```

## TODO

- [ ] Merge
    - [ ] recursive
    - [ ] octopus
