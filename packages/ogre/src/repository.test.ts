import test from "ava";

import { Repository } from "./repository";
import {
  addOneStep as addOneNested,
  ComplexObject,
  getBaseline,
  sumChanges,
  testAuthor,
  updateHeaderData,
} from "./test.utils";

test("reconstruction", async (t) => {
  const [repo, wrapped] = await getBaseline();

  let changeEntries = updateHeaderData(wrapped);
  await repo.commit("header data", testAuthor);

  changeEntries += addOneNested(wrapped);
  const firstStep = await repo.commit("first step", testAuthor);

  const history = repo.getHistory();
  t.is(repo.head(), "refs/heads/main", "HEAD is wrong");
  t.is(
    repo.ref("refs/heads/main"),
    firstStep,
    "main is pointing at wrong commit"
  );
  t.is(history.commits.length, 2, "incorrect # of commits");

  // start reconstruction
  const p = new ComplexObject();
  const repo2 = new Repository(p, { history });

  const history2 = repo2.getHistory();
  t.is(history2.commits.length, 2, "incorrect # of commits");
  t.is(
    sumChanges(history2.commits),
    changeEntries,
    "incorrect # of changelog entries"
  );
});

test("reconstruct with 2 commits", async (t) => {
  const [repo, wrapped] = await getBaseline();

  let changeEntries = updateHeaderData(wrapped);
  await repo.commit("header data", testAuthor);

  changeEntries += addOneNested(wrapped);
  const first = await repo.commit("first nested", testAuthor);

  t.is(repo.ref("refs/heads/main"), first, "main is pointing at wrong commit");

  changeEntries += addOneNested(wrapped);
  const second = await repo.commit("second nested", testAuthor);

  const history = repo.getHistory();

  t.is(repo.ref("refs/heads/main"), second, "main is pointing at wrong commit");
  t.is(history.commits.length, 3, "incorrect # of commits");

  // start reconstruction
  const p = new ComplexObject();
  const repo2 = new Repository(p, { history });

  const history2 = repo2.getHistory();
  t.is(history2.commits.length, 3, "incorrect # of commits");
  t.is(
    sumChanges(history2.commits),
    changeEntries,
    "incorrect # of changelog entries"
  );
});

test("history contains HEAD ref", async (t) => {
  const [repo] = await getBaseline();

  t.is(repo.head(), "refs/heads/main");

  const history = repo.getHistory();
  let headRef = history.refs.get("HEAD");
  t.not(headRef, undefined);
  t.is(headRef!.name, "HEAD");
  t.is(headRef!.value, "ref: refs/heads/main");
});
