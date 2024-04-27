import { test } from "tap";
import { getBaseline, sumChanges, testAuthor } from "./test.utils.js";

test("current branch on empty repo is HEAD", async (t) => {
  const [repo] = await getBaseline();

  t.equal(repo.branch(), "HEAD", "invalid current branch");
});

test("first commit goes onto default 'main' branch", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  await repo.commit("initial commit", testAuthor);

  t.equal(repo.branch(), "main", "invalid current branch");
  t.equal(repo.head(), "refs/heads/main", "invalid HEAD");
});

test("fails to create a branch with empty repo", async (t) => {
  const [repo] = await getBaseline();
  let history = repo.getHistory();
  t.equal(history.commits.length, 0, "incorrect # of commits");
  t.equal(
    sumChanges(history?.commits),
    0,
    "new branch w/ incorrect # of changelog entries",
  );

  t.throws(
    () => {
      // cannot point new branch to nothing on empty repo
      repo.createBranch("new_feature");
    },
    { message: "fatal: not a valid object name: 'main'" },
  );
});

test("checkout new branch with empty repo", async (t) => {
  const [repo] = await getBaseline();

  repo.checkout("new_feature", true);
  t.equal(
    repo.head(),
    "refs/heads/new_feature",
    "HEAD did not move to new branch",
  );
  t.equal(
    repo.ref("/refs/heads/main"),
    undefined,
    "main should not be pointing to anything",
  );
  t.equal(
    repo.ref("refs/heads/new_feature"),
    undefined,
    "new_feature should not be pointing to anything",
  );
});

test("creating a valid branch on a baseline", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  const commit = await repo.commit("simple change", testAuthor);
  const ref = repo.createBranch("new_feature");
  t.equal(ref, "refs/heads/new_feature", "invalid branch ref created");
  t.equal(repo.ref(ref), commit, "new branch is pointing to wrong commit");
});

test("cannot create new branch with invalid name", async (t) => {
  const [repo] = await getBaseline();

  for (const name of ["", "-foo", "HEAD"]) {
    t.throws(
      () => {
        repo.createBranch(name);
      },
      { message: "invalid ref name" },
    );
  }
});
