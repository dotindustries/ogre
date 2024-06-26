import { test } from "tap";
import { getBaseline, testAuthor } from "./test.utils.js";

test("merge with no commit fails", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  await repo.commit("simple change", testAuthor);

  repo.createBranch("new_feature");

  await t.rejects(repo.merge("new_feature"), { message: "already up to date" });
});

test("merge fast-forward", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "new name";
  await repo.commit("simple change", testAuthor);
  const masterCommitCount = repo.getHistory().commits.length;

  await repo.checkout("new_branch", true);
  repo.data.name = "another name";
  const minorHash = await repo.commit("minor change", testAuthor);
  t.equal(
    repo.head(),
    "refs/heads/new_branch",
    "HEAD not pointing to new_branch",
  );
  t.equal(
    repo.ref("refs/heads/new_branch"),
    minorHash,
    "branch did not move to new commit",
  );

  // go to destination branch
  await repo.checkout("main");
  const mergeHash = await repo.merge("new_branch");
  const headRef = repo.head();
  const refHash = repo.ref(headRef);

  t.equal(mergeHash, minorHash, "did not fast-forward to expected commit");
  t.equal(refHash, mergeHash, `master is not at expected commit`);
  t.equal(
    repo.getHistory().commits.length,
    masterCommitCount + 1,
    "fast-forward failed, superfluous commit detected",
  );
});
