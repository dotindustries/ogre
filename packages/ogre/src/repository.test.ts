import { test } from "tap";

import { Repository } from "./repository";
import {
  addOneStep,
  addOneStep as addOneNested,
  ComplexObject,
  getBaseline,
  sumChanges,
  testAuthor,
  updateHeaderData,
} from "./test.utils";
import { History, Reference } from "./interfaces";
import { compare, Operation } from "fast-json-patch";
import { printChange, printChangeLog } from "./utils";

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

test("restore", async (t) => {
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
});

test("history", async (t) => {
  t.test("history contains HEAD ref", async (t) => {
    const [repo] = await getBaseline();

    t.equal(repo.head(), "refs/heads/main");

    const history = repo.getHistory();
    let headRef = history.refs.get("HEAD");
    t.not(headRef, undefined);
    t.equal(headRef!.name, "HEAD");
    t.equal(headRef!.value, "ref: refs/heads/main");
  });

  t.test("empty history unreachable HEAD", async (t) => {
    const co: ComplexObject = { nested: [] };
    t.throws(
      () =>
        new Repository(co, {
          history: {
            original: co,
            refs: new Map<string, Reference>(),
            commits: [],
          } as History,
        }),
      {
        message: "unreachable: 'HEAD' is not present",
      },
    );
  });
});

test("reset", async (t) => {
  t.test("reset hard", async (t) => {
    const [repo, co] = await getBaseline();
    co.uuid = "asdf";
    const hash = await repo.commit("baseline", testAuthor);
    const h1 = repo.getHistory();
    t.equal(h1.commits.length, 1);
    // do changes
    const changes = updateHeaderData(co);
    const diff = repo.diff(hash);
    t.equal(diff.length, changes, "wrong # of changes in diff");

    // reset
    repo.reset("hard");
    const diff2 = repo.diff(hash);
    t.equal(diff2.length, 0, "failed to reset");
  });
});

test("status", async (t) => {
  t.test("clean repo no change", async (t) => {
    const [repo] = await getBaseline();
    const cleanState = repo.status();
    t.match(cleanState, [], "Shouldn't have pending changes");
  });
  t.test("clean repo pending change", async (t) => {
    const [repo] = await getBaseline({ name: "base name" });
    repo.data.name = "changed name";
    const dirtyState = repo.status();
    t.equal(
      dirtyState.length,
      1,
      `Status doesn't contain the expected # of changes: ${JSON.stringify(dirtyState)}`,
    );
  });
  t.test("reading status shouldn't clean observer", async (t) => {
    const [repo] = await getBaseline({ name: "base name" });
    repo.data.name = "changed name";
    const dirtyState = repo.status();
    t.equal(
      dirtyState.length,
      1,
      `Status doesn't contain the expected # of changes: ${JSON.stringify(dirtyState)}`,
    );

    const dirtyState2 = repo.status();
    t.equal(
      dirtyState2.length,
      1,
      `Status doesn't contain the expected # of changes: ${JSON.stringify(dirtyState)}`,
    );
    t.match(dirtyState2, dirtyState2, "why different pending changes??");
  });
  t.test("after commit no change", async (t) => {
    const [repo] = await getBaseline();
    repo.data.name = "new name";
    await repo.commit("baseline", testAuthor);
    const cleanState = repo.status();
    t.match(cleanState, [], "Shouldn't have pending changes");
  });
  t.test("after commit pending change", async (t) => {
    const [repo] = await getBaseline();
    repo.data.name = "new name";
    await repo.commit("baseline", testAuthor);
    const cleanState = repo.status();
    t.match(cleanState, [], "Shouldn't have pending changes");
    repo.data.name = "changed name";
    const dirtyState = repo.status();
    t.equal(dirtyState.length, 1, "Status doesn't contain changes");
  });
  t.test("after commit pending change for rewrite array", async (t) => {
    const [repo] = await getBaseline();
    repo.data.name = "new name";
    await repo.commit("baseline", testAuthor);
    const cleanState = repo.status();
    t.match(cleanState, [], "Shouldn't have pending changes");
    repo.data.nested = [{ name: "new item", uuid: "asdf" }];
    const dirtyState = repo.status();
    t.equal(dirtyState.length, 1, "Status doesn't contain changes");
  });
  t.test("change of nested array element prop", async (t) => {
    const [repo] = await getBaseline();
    repo.data.name = "new name";
    addOneStep(repo.data);
    await repo.commit("baseline", testAuthor);
    const cleanState = repo.status();
    t.match(cleanState, [], "Shouldn't have pending changes");
    repo.data.nested[0].name = "another name which is different";
    const dirtyState = repo.status();
    t.equal(dirtyState?.length, 1, "Status doesn't contain changes");
  });
});

test("apply", async (t) => {
  t.test("single patch", async (t) => {
    const [repo] = await getBaseline({ name: "base name" });
    const cleanState = repo.status();
    t.match(cleanState, [], "Shouldn't have pending changes");

    const targetState = {
      uuid: undefined,
      name: "a name",
      description: undefined,
      nested: [{ name: "new item", uuid: "asdf" }],
    };
    const patches = compare(repo.data, targetState);
    // this should record changes on the observer
    const err = repo.apply(patches);
    t.match(err, undefined, "Failed to apply patch");
    t.match(repo.data, targetState, "The final state does not match up");
    const dirtyState = repo.status();
    t.equal(dirtyState.length, 2, "Status doesn't contain changes");
    t.match(dirtyState, patches, "It should have the right changes");
  });

  t.test("patch for undefined props with workaround", async (t) => {
    // solution for workaround from: https://github.com/Starcounter-Jack/JSON-Patch/issues/280
    const [repo] = await getBaseline();
    const cleanState = repo.status();
    t.match(cleanState, [], "Shouldn't have pending changes");

    const targetState: ComplexObject = {
      uuid: undefined,
      description: undefined,
      name: "a name",
      nested: [],
    };
    const patches = compare(repo.data, targetState);
    // this should record changes on the observer
    const err = repo.apply(patches);
    t.equal(err, undefined, "Failed to apply patch");

    t.match(repo.data, targetState, "The final state should match up");
    const dirtyState = repo.status();
    t.equal(dirtyState.length, 1, "Status should contain 1 change");
  });

  t.test("multiple patches", async (t) => {
    const [repo] = await getBaseline({ name: "base name" });

    const cleanState = repo.status();
    t.match(cleanState, [], "Shouldn't have pending changes");
    const targetState = {
      uuid: undefined,
      name: "a name",
      description: undefined,
      nested: [{ name: "new item", uuid: "asdf" }],
    };
    const patches = compare(repo.data, targetState);
    const err = repo.apply(patches);
    t.equal(err, undefined, "Failed to apply patch");
    const dirtyState = repo.status();
    t.equal(dirtyState?.length, 2, "Status doesn't contain changes");
    t.match(dirtyState, patches, "It should have the right changes");
    t.match(repo.data, targetState, "The final state does not match up");
  });
});
