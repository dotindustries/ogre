import test from "ava";
import {
  addOneStep,
  ComplexObject,
  getBaseline,
  sumChanges,
  testAuthor,
  updateHeaderData,
} from "./test.utils";
import { Repository } from "./repository";

test("checkout prev commit", async (t) => {
  const [repo, obj] = await getBaseline();

  updateHeaderData(obj);
  const headerDataHash = await repo.commit("header data", testAuthor);

  addOneStep(obj);
  await repo.commit("first step", testAuthor);

  repo.checkout(headerDataHash);
  const head = repo.head();
  const history = repo.getHistory();
  t.is(sumChanges(history.commits), 3, `incorrect # of changelog entries`);
  t.is(history.commits.length, 1, "incorrect # of commits");
  t.is(head, headerDataHash, `points to wrong commit`);
  t.is(repo.branch(), "HEAD", "repo is not in detached state");
  t.deepEqual(
    obj.nested.length,
    0,
    `has a nested object when it shouldn't: ${JSON.stringify(obj)}`
  );
});

test("checkout new branch with simple name", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  await repo.commit("simple change", testAuthor);

  const ref = repo.createBranch("new_feature");
  repo.checkout("new_feature");
  t.is(repo.head(), ref, "HEAD is not moved to target branch");
});

test("checkout new branch with full ref name", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  await repo.commit("simple change", testAuthor);

  const ref = repo.createBranch("new_feature");
  repo.checkout(ref);
  t.is(repo.head(), ref, "HEAD is not moved to target branch");
});

test("checkout commit which has two refs pointing leaves HEAD detached", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  const commit = await repo.commit("simple change", testAuthor);

  repo.createBranch("new_feature");
  repo.checkout(commit);
  t.is(repo.ref("refs/heads/main"), commit, "main does not point to commit");
  t.is(
    repo.ref("refs/heads/new_feature"),
    commit,
    "new_feature does not point to commit"
  );
  t.is(repo.branch(), "HEAD", "HEAD is not detached at commit");
  t.is(repo.head(), commit, "HEAD is not pointing to commit");
});

test("checkout new branch moves head to new branch", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  await repo.commit("simple change", testAuthor);

  const ref = repo.createBranch("new_feature");
  repo.checkout("new_feature");
  t.is(repo.head(), ref, "HEAD is not moved to target branch");
});

test("checkout and create new branch on empty main", async (t) => {
  const [repo] = await getBaseline();

  repo.checkout("new_feature", true);
  t.is(
    repo.head(),
    "refs/heads/new_feature",
    "HEAD should point to empty branch"
  );
  t.is(repo.branch(), "HEAD", "branch still should be empty");
});

test("checkout and create new branch with at least 1 commit", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  const commit = await repo.commit("simple change", testAuthor);

  repo.checkout("new_feature", true);
  t.is(
    repo.head(),
    "refs/heads/new_feature",
    "HEAD should point to new branch"
  );
  t.is(
    repo.ref("refs/heads/new_feature"),
    commit,
    "branch is not pointing to last HEAD commit"
  );
});

test("replacing default branch on empty master removes main", async (t) => {
  const repo = new Repository(new ComplexObject(), {});

  // replacing default main branch by moving HEAD to new branch
  // is OK even on empty repo
  repo.checkout("new_feature", true);
  const history = repo.getHistory();
  t.is(
    sumChanges(history?.commits),
    0,
    "new branch w/ incorrect # of changelog entries"
  );

  repo.data.name = "name changed";
  repo.data.description = "description changed";
  await repo.commit("description changes", testAuthor);

  t.throws(
    () => {
      repo.checkout("main");
    },
    { message: `pathspec 'main' did not match any known refs` }
  );
});
