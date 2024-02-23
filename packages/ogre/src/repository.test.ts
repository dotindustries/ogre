import { test } from "tap";

import { Repository } from "./repository";
import {
  addOneStep as addOneNested,
  ComplexObject,
  getBaseline,
  sumChanges,
  testAuthor,
  updateHeaderData,
} from "./test.utils";

test("restore", (t) => {
  t.test("history check", async (t) => {
    const [repo, wrapped] = await getBaseline();

    let changeEntries = updateHeaderData(wrapped);
    await repo.commit("header data", testAuthor);

    changeEntries += addOneNested(wrapped);
    const firstStep = await repo.commit("first step", testAuthor);

    const history = repo.getHistory();
    t.equal(repo.head(), "refs/heads/main", "HEAD is wrong");
    t.equal(
      repo.ref("refs/heads/main"),
      firstStep,
      "main is pointing at wrong commit",
    );
    t.equal(history.commits.length, 2, "incorrect # of commits");

    // start reconstruction
    const p = {};
    const repo2 = new Repository(p, { history });

    const history2 = repo2.getHistory();
    t.equal(
      history2.commits.length,
      history.commits.length,
      "incorrect # of commits",
    );
    t.equal(
      sumChanges(history2.commits),
      sumChanges(history.commits),
      "incorrect # of changelog entries",
    );
  });

  t.test("reconstruct with 2 commits", async (t) => {
    const [repo, wrapped] = await getBaseline();

    let changeEntries = updateHeaderData(wrapped);
    await repo.commit("header data", testAuthor);

    addOneNested(wrapped);
    changeEntries++;
    const first = await repo.commit("first nested", testAuthor);

    t.equal(
      repo.ref("refs/heads/main"),
      first,
      "main is pointing at wrong commit",
    );

    addOneNested(wrapped);
    changeEntries++;

    const second = await repo.commit("second nested", testAuthor);

    const history = repo.getHistory();

    t.equal(
      repo.ref("refs/heads/main"),
      second,
      "main is pointing at wrong commit",
    );
    t.equal(history.commits.length, 3, "incorrect # of commits");

    // start reconstruction
    const p = {};
    const repo2 = new Repository(p, { history });

    const history2 = repo2.getHistory();
    t.equal(
      history2.commits.length,
      history.commits.length,
      "incorrect # of commits",
    );
    t.equal(
      sumChanges(history2.commits),
      sumChanges(history.commits),
      "incorrect # of changelog entries",
    );
  });

  test("restoring from history", async (t) => {
    const [repo, obj] = await getBaseline();
    updateHeaderData(obj);
    await repo.commit("header data", testAuthor);
    addOneNested(obj);
    await repo.commit("first nested", testAuthor);
    repo.tag("v0.1.0");

    const history = repo.getHistory();

    const obj2 = {};
    // @ts-ignore
    const repo2 = new Repository(obj2, { history });

    t.matchOnly(obj, obj2, "restored object does not equal last version.");
  });

  t.end();
});

test("history", (t) => {
  t.test("history contains HEAD ref", async (t) => {
    const [repo] = await getBaseline();

    t.equal(repo.head(), "refs/heads/main");

    const history = repo.getHistory();
    let headRef = history.refs.get("HEAD");
    t.not(headRef, undefined);
    t.equal(headRef!.name, "HEAD");
    t.equal(headRef!.value, "ref: refs/heads/main");
  });

  t.end();
});

test("diff is ok", async (t) => {
  const [repo, obj] = await getBaseline();

  updateHeaderData(obj);
  const zeroth = await repo.commit("header data", testAuthor);

  let changeEntries = addOneNested(obj);
  const first = await repo.commit("first nested", testAuthor);

  t.equal(
    repo.ref("refs/heads/main"),
    first,
    "main is pointing at wrong commit",
  );

  changeEntries += addOneNested(obj);

  const second = await repo.commit("second nested", testAuthor);

  const diff = repo.diff(zeroth);
  t.equal(
    diff.length,
    changeEntries,
    `invalid # of change entries: ${JSON.stringify(diff)}`,
  );
});

test("reset", (t) => {
  t.test("reset hard", async (t) => {});
  t.end();
});
