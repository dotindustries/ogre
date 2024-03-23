import { test } from "tap";

import {
  addOneStep,
  ComplexObject,
  getBaseline,
  sumChanges,
  testAuthor,
  updateHeaderData,
} from "./test.utils";
import { printChangeLog, Repository } from "./repository";

test("baseline with 1 commit and zero changelog entries", async (t) => {
  const [repo] = await getBaseline();

  const history = repo.getHistory();
  t.equal(sumChanges(history.commits), 0, "has changelog entries");
  t.equal(history.commits.length, 0, "incorrect # of commits");
});

test("head points to main", async (t) => {
  const [repo] = await getBaseline();

  t.equal(repo.head(), "refs/heads/main", "head not pointing where it should");
});

test("changes are available for commit if starting from empty", async (t) => {
  const repo = new Repository<ComplexObject>({}, {});
  repo.data.name = "some data";

  const dirty = repo.status();

  t.equal(
    dirty.length,
    1,
    "Status does not contain the right amount of changes",
  );
  await repo.commit("baseline", testAuthor);
  t.pass();
});

test("no commit without changes", async (t) => {
  const [repo] = await getBaseline();

  await t.rejects(repo.commit("baseline", testAuthor), {
    message: "no changes to commit",
  });
});

test("no commit without changes after recent commit", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  await repo.commit("baseline", testAuthor);

  await t.rejects(repo.commit("baseline", testAuthor), {
    message: "no changes to commit",
  });
});

test("overwrite nested array changes are recognized", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  await repo.commit("baseline", testAuthor);
  repo.data.nested = [{ name: "new item", uuid: "asdf" }];
  await repo.commit("overwrite nested array", testAuthor);
});

test("change of nested array element is recognized", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  addOneStep(repo.data);
  await repo.commit("baseline", testAuthor);
  repo.data.nested[0].name = "another name which is different";
  await repo.commit("changed nested array object", testAuthor);
});

test("treeHash of commit is matching content", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  await repo.commit("baseline", testAuthor);
  const { commits } = repo.getHistory();
  t.equal(commits.length, 1);
  t.not(commits[0].tree, "", "tree hash mismatch");
});

test("no commit --amend without commit", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";

  await t.rejects(repo.commit("baseline", testAuthor, true), {
    message: "no commit to amend",
  });
});

test("main moves to recent commit", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  const hash = await repo.commit("baseline", testAuthor);

  t.equal(
    repo.ref("refs/heads/main"),
    hash,
    "head does not point to recent commit",
  );
});

test("two commits with 3 changes", async (t) => {
  const [repo, wrapped] = await getBaseline();
  updateHeaderData(wrapped);
  await repo.commit("header data", testAuthor);

  const history = repo.getHistory();
  t.equal(sumChanges(history.commits), 3, "incorrect # of changelog entries");
  t.equal(history.commits.length, 1, "incorrect # of commits");
});

test("array push double-change, 6 changes, 3 commits", async (t) => {
  const [repo, wrapped] = await getBaseline();

  updateHeaderData(wrapped);
  await repo.commit("header data", testAuthor);

  addOneStep(wrapped);
  await repo.commit("first step", testAuthor);

  const history = repo.getHistory();
  t.equal(sumChanges(history.commits), 4, "incorrect # of changelog entries");
  t.equal(history.commits.length, 2, "incorrect # of commits");
  t.equal(
    history.commits[0].changes.length,
    3,
    "#incorrect # of changes in commit#1",
  );
  t.equal(
    history.commits[1].changes.length,
    1,
    "#incorrect # of changes in commit#2",
  );
});

test("all refs OK, when committing on new branch while main is empty main", async (t) => {
  const [repo] = await getBaseline();
  repo.checkout("new_feature", true);
  repo.data.name = "new name";
  const commit = await repo.commit("simple change", testAuthor);

  t.equal(
    repo.ref("refs/heads/main"),
    undefined,
    "main should not point to a commit",
  );
  t.equal(
    repo.ref("refs/heads/new_feature"),
    commit,
    "new_feature should point to last commit",
  );
  t.equal(repo.branch(), "new_feature", "branch should now be visible");
  t.equal(
    repo.head(),
    "refs/heads/new_feature",
    "HEAD is pointing to wrong branch",
  );
});

test("commit --amend changes hash on content change", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  const commitToAmend = await repo.commit("name change", testAuthor);
  repo.data.description = "new description";
  const changedHash = await repo.commit(
    "name and description change",
    testAuthor,
    true,
  );
  t.not(changedHash, commitToAmend, "hash should have changed");
  const history = repo.getHistory();
  t.equal(history.commits.length, 1, "wrong # of commits");
  // @ts-ignore
  t.equal(
    sumChanges(history.commits),
    2,
    `wrong # of changes: ${JSON.stringify(
      history.commits.flatMap((c) => c.changes),
    )}`,
  );
  t.equal(repo.head(), "refs/heads/main", "HEAD is not pointing to main");
  t.equal(repo.branch(), "main", "we are on the wrong branch");
  t.equal(
    repo.ref("refs/heads/main"),
    changedHash,
    "main should point to changed commit hash",
  );
});

test("commit --amend changes hash on message change", async (t) => {
  const [repo, data] = await getBaseline();
  data.name = "new name";
  const commitToAmend = await repo.commit("name change", testAuthor);

  // data.name = "another name";
  const changedHash = await repo.commit("initial setup", testAuthor, true);

  t.not(changedHash, commitToAmend, "hash should have changed");
  const history = repo.getHistory();
  t.equal(history.commits.length, 1, "wrong # of commits");
  t.equal(sumChanges(history.commits), 1, "wrong # of changes");
  t.equal(repo.head(), "refs/heads/main", "HEAD is not pointing to main");
  t.equal(repo.branch(), "main", "we are on the wrong branch");
  t.equal(
    repo.ref("refs/heads/main"),
    changedHash,
    "main should point to changed commit hash",
  );
});

test("commit at detached HEAD does not affect main, but moves head", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  const v1 = repo.data;
  const commit = await repo.commit("name change", testAuthor);

  repo.data.description = "new fancy description";
  const last = await repo.commit("desc change", testAuthor);

  repo.checkout(commit);
  t.equal(repo.head(), commit, "HEAD did not move to commit");
  t.equal(repo.branch(), "HEAD", "repo is not in detached state");
  t.matchOnly(v1, repo.data, "object state does not match");

  repo.data.description = "a different description";
  const commitOnDetached = await repo.commit("msg", testAuthor);
  t.equal(repo.head(), commitOnDetached, "HEAD did not move to commit");
  t.equal(
    repo.ref("refs/heads/main"),
    last,
    "main branch did not stay at last commit",
  );
});

test("commit at detached HEAD saved to a branch", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  const commit = await repo.commit("name change", testAuthor);
  repo.data.description = "new fancy description";
  await repo.commit("desc change", testAuthor);
  repo.checkout(commit);

  repo.data.description = "a different description";
  const commitOnDetached = await repo.commit("msg", testAuthor);

  const savepointRef = repo.createBranch("savepoint");
  t.equal(
    repo.ref(savepointRef),
    commitOnDetached,
    "savepoint branch should point to last detached commit",
  );
});

test("commit --amend changes hash on message change even in detached HEAD", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  const commitToAmend = await repo.commit("name change", testAuthor);
  repo.data.description = "desc change";
  const descCommit = await repo.commit("desc change", testAuthor);
  repo.checkout(commitToAmend);
  const changedHash = await repo.commit("initial setup", testAuthor, true);
  t.not(changedHash, commitToAmend, "hash should have changed");
  const history = repo.getHistory();
  t.equal(history.commits.length, 1, "wrong # of commits");
  t.equal(sumChanges(history.commits), 1, "wrong # of changes");
  t.equal(repo.branch(), "HEAD", "not in detached state");
  t.equal(repo.head(), changedHash, "HEAD is not pointing to detached commit");
  t.equal(
    repo.ref("refs/heads/main"),
    descCommit,
    "main should point to changed commit hash",
  );
});
