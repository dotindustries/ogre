import { test } from "tap";
import superjson from "superjson";

import { Repository } from "./repository.js";
import {
  addOneStep,
  addOneStep as addOneNested,
  type ComplexObject,
  getBaseline,
  sumChanges,
  testAuthor,
  updateHeaderData,
} from "./test.utils.js";
import type {Reference} from "./interfaces.js";
import { compare } from "fast-json-patch";
import {objectToTree, treeToObject} from "./serialize.js";

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

  const diff = await repo.diff(zeroth);
  t.equal(
    diff.length,
    changeEntries,
    `invalid # of change entries: ${JSON.stringify(diff)}`,
  );
});

test("restore", async (t) => {
  t.test("history check", async (t) => {
    const [repo, wrapped] = await getBaseline();

    updateHeaderData(wrapped);
    await repo.commit("header data", testAuthor);

    addOneNested(wrapped);
    const firstStep = await repo.commit("first step", testAuthor);

    const history = repo.getHistory();
    t.equal(repo.head(), "refs/heads/main", "HEAD is wrong");
    t.equal(
      repo.ref("refs/heads/main"),
      firstStep,
      "main is pointing at wrong commit",
    );
    t.equal(history.commits.length, 2, "incorrect # of commits");
    const logs = repo.logs()
    t.equal(logs.length, 3, "incorrect # of logs")
    const logs1 = repo.logs(1)
    t.equal(logs1.length, 1, "incorrect # of logs retrieved")

    const logs2 = repo.logs(100)
    t.equal(logs2.length, 3, "incorrect # of logs retrieved")

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

  t.test("date stays date", async (t) => {
    /**
     * Serialize an object to a string using the Ogre library.
     * This is useful for storing and retrieving objects in a repository.
     * @param obj
     */
    const serializeObject = async (obj: any) => {
      return objectToTree(obj, superjson.stringify)
    }

    /**
     * Deserialize an object from a string using the Ogre library.
     * This is useful for retrieving objects from a repository.
     * @param str
     */
    const deserializeObject = async <T>(str: string) => {
      return treeToObject(str, superjson.parse<T>)
    }

    const [repo, wrapped] = await getBaseline(
      undefined,
      serializeObject,
        deserializeObject
    );

    updateHeaderData(wrapped);
    wrapped.aDate = new Date();
    await repo.commit("header data", testAuthor);

    t.equal(repo.getHistory().commits.length, 1, "incorrect # of commits");

    const repo2 = new Repository<ComplexObject>(
      {},
      {
        history: repo.getHistory(),
        overrides: {
          serializeObjectFn: serializeObject,
          deserializeObjectFn: deserializeObject
        },
      },
    );
    await repo2.isReady();

    t.equal(repo2.data.aDate instanceof Date, true, "date is not a date");
    t.matchStrict(
      repo2.data,
      repo.data,
      "restored object does not equal last version.",
    );
    t.equal(
      sumChanges(repo2.getHistory().commits),
      sumChanges(repo.getHistory().commits),
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
});

test("history", async (t) => {
  t.test("successful restore", async (t) => {
    const [repo, obj] = await getBaseline();
    updateHeaderData(obj);
    await repo.commit("header data", testAuthor);
    addOneNested(obj);
    await repo.commit("first nested", testAuthor);
    repo.tag("v0.1.0");

    const history = repo.getHistory();

    const obj2 = {};
    const repo2 = new Repository(obj2, { history });
    await repo2.isReady();

    t.matchOnlyStrict(
      obj,
      obj2,
      "restored object does not equal last version.",
    );
    t.not(obj, obj2, "should not be the js ref");
  });

  t.test("remoteRefs doesn't change on commit", async (t) => {
    const repo = new Repository<ComplexObject>({}, {});
    updateHeaderData(repo.data);
    await repo.commit("header data", testAuthor);

    const history = repo.getHistory();

    const r2 = new Repository<ComplexObject>({}, { history });
    await r2.isReady();
    const remoteBeforeChange = r2.remote();

    r2.data.name = "a different name";
    await r2.commit("changed name", testAuthor);

    const remoteAfterChange = r2.remote();

    const history2 = r2.getHistory();

    t.not(
      remoteBeforeChange,
      history.refs,
      "input history refs and remote before change should not be the same object",
    );
    t.matchOnlyStrict(
      remoteBeforeChange,
      history.refs,
      "remote before change is not the same as history input",
    );
    t.matchOnlyStrict(
      remoteAfterChange,
      remoteBeforeChange,
      "remote before and after change are not the same",
    );
    t.notMatchOnlyStrict(
      history2.refs,
      remoteAfterChange,
      "history refs must not be the same as static remotes",
    );
    t.notMatchOnlyStrict(
      history.refs,
      history2.refs,
      "histories must not match anymore",
    );
  });

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
            refs: new Map<string, Reference>(),
            commits: [],
          },
        }),
      {
        message: "unreachable: 'HEAD' is not present",
      },
    );
  });
});

test("reset", async (t) => {
  t.test("discard uncommitted changes", async (t) => {
    const [repo, co] = await getBaseline();
    co.uuid = "asdf";
    const hash = await repo.commit("baseline", testAuthor);
    const h1 = repo.getHistory();
    t.equal(h1.commits.length, 1);
    // do changes
    const changes = updateHeaderData(co);
    const diff = await repo.diff(hash);
    t.equal(diff.length, changes, "wrong # of changes in diff");

    // reset
    await repo.reset("hard");
    const diff2 = await repo.diff(hash);
    t.equal(diff2.length, 0, "failed to reset");
  });

  t.test("reset to earlier commit", async t => {
    const [repo, co] = await getBaseline();
    co.uuid = "asdf";
    const hash = await repo.commit("baseline", testAuthor);
    const h1 = repo.getHistory();
    t.equal(h1.commits.length, 1);

    // do changes
    const changes = updateHeaderData(co);
    const hash2 = await repo.commit("header data", testAuthor);
    const h2 = repo.getHistory();
    t.equal(h2.commits.length, 2);
    const diff = await repo.diff(hash);
    t.equal(diff.length, changes, "wrong # of changes in diff");
    t.equal(hash !== hash2, true, "hash should not be the same");

    // reset
    await repo.reset("hard", hash);
    const diff2 = await repo.diff(hash);
    t.equal(diff2.length, 0, "failed to reset");
    const h3 = repo.getHistory()
    t.equal(h3.refs.get("refs/heads/main")!.value, hash, "main should point to first hash");
  })

  t.test("reset to earlier version tag", async t => {
    const [repo, co] = await getBaseline();
    co.uuid = "asdf";
    const hash = await repo.commit("baseline", testAuthor);
    repo.tag("v0.1.0")
    const h1 = repo.getHistory();
    t.equal(h1.commits.length, 1);

    // do changes
    const changes = updateHeaderData(co);
    const hash2 = await repo.commit("header data", testAuthor);
    repo.tag("v0.2.0")
    const h2 = repo.getHistory();
    t.equal(h2.commits.length, 2);
    const diff = await repo.diff(hash);
    t.equal(diff.length, changes, "wrong # of changes in diff");
    t.equal(hash !== hash2, true, "hash should not be the same");

    // reset
    await repo.reset("hard", "v0.1.0");
    const diff2 = await repo.diff(hash);
    t.equal(diff2.length, 0, "failed to reset");
    const h3 = repo.getHistory()
    t.equal(h3.refs.get("refs/heads/main")!.value, hash, "main should point to first hash");
  })
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
    const dirtyState = await repo.status();
    t.equal(
      dirtyState.length,
      1,
      `Status doesn't contain the expected # of changes: ${JSON.stringify(dirtyState)}`,
    );
  });
  t.test("reading status shouldn't clean observer", async (t) => {
    const [repo] = await getBaseline({ name: "base name" });
    repo.data.name = "changed name";
    const dirtyState = await repo.status();
    t.equal(
      dirtyState.length,
      1,
      `Status doesn't contain the expected # of changes: ${JSON.stringify(dirtyState)}`,
    );

    const dirtyState2 = await repo.status();
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
    const cleanState = await repo.status();
    t.match(cleanState, [], "Shouldn't have pending changes");
  });
  t.test("after commit pending change", async (t) => {
    const [repo] = await getBaseline();
    repo.data.name = "new name";
    await repo.commit("baseline", testAuthor);
    const cleanState = await repo.status();
    t.match(cleanState, [], "Shouldn't have pending changes");
    repo.data.name = "changed name";
    const dirtyState = await repo.status();
    t.equal(dirtyState.length, 1, "Status doesn't contain changes");
  });
  t.test("after commit pending change for rewrite array", async (t) => {
    const [repo] = await getBaseline();
    repo.data.name = "new name";
    await repo.commit("baseline", testAuthor);
    const cleanState = await repo.status();
    t.match(cleanState, [], "Shouldn't have pending changes");
    repo.data.nested = [{ name: "new item", uuid: "asdf" }];
    const dirtyState = await repo.status();
    t.equal(dirtyState.length, 1, "Status doesn't contain changes");
  });
  t.test("change of nested array element prop", async (t) => {
    const [repo] = await getBaseline();
    repo.data.name = "new name";
    addOneStep(repo.data);
    await repo.commit("baseline", testAuthor);
    const cleanState = await repo.status();
    t.match(cleanState, [], "Shouldn't have pending changes");
    repo.data.nested[0].name = "another name which is different";
    const dirtyState = await repo.status();
    t.equal(dirtyState?.length, 1, "Status doesn't contain changes");
  });
});

test("apply", async (t) => {
  t.test("single patch", async (t) => {
    const [repo] = await getBaseline({ name: "base name" });
    const cleanState = await repo.status();
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
    const dirtyState = await repo.status();
    t.equal(dirtyState.length, 2, "Status doesn't contain changes");
    t.match(dirtyState, patches, "It should have the right changes");
  });

  t.test("patch for undefined props with workaround", async (t) => {
    // solution for workaround from: https://github.com/Starcounter-Jack/JSON-Patch/issues/280
    const [repo] = await getBaseline();
    const cleanState = await repo.status();
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
    const dirtyState = await repo.status();
    t.equal(dirtyState.length, 1, "Status should contain 1 change");
  });

  t.test("multiple patches", async (t) => {
    const [repo] = await getBaseline({ name: "base name" });

    const cleanState = await repo.status();
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
    const dirtyState = await repo.status();
    t.equal(dirtyState?.length, 2, "Status doesn't contain changes");
    t.match(dirtyState, patches, "It should have the right changes");
    t.match(repo.data, targetState, "The final state does not match up");
  });
});

test("pending changes - push helpers", async (t) => {
  t.test("1 commit & 1 ref update", async (t) => {
    const [repo, obj] = await getBaseline();
    updateHeaderData(obj);
    await repo.commit("header data", testAuthor);
    addOneNested(obj);
    await repo.commit("first nested", testAuthor);
    repo.tag("v0.1.0");
    const history = repo.getHistory();

    const repo2 = new Repository<ComplexObject>({}, { history });

    repo2.data.description = "changed description";
    const hash = await repo2.commit("changed desc", testAuthor);
    const { commits } = repo2.getHistory();
    const pendingCommit = commits.find((c) => c.hash === hash);

    const pending = repo2.cherry();

    t.equal(pending.commits.length, 1, "incorrect number of pending commits");
    t.equal(pending.refs.size, 1, "incorrect number of pending ref updates");
    t.matchOnly(pending.commits[0], pendingCommit, "wrong pending commit");
    t.matchOnlyStrict(
      Array.from(pending.refs.keys()),
      ["refs/heads/main"],
      "wrong pending ref update",
    );
  });

  t.test("2 commit & 1 ref update", async (t) => {
    const [repo, obj] = await getBaseline();
    updateHeaderData(obj);
    await repo.commit("header data", testAuthor);
    addOneNested(obj);
    await repo.commit("first nested", testAuthor);
    repo.tag("v0.1.0");
    const history = repo.getHistory();

    const repo2 = new Repository<ComplexObject>({}, { history });

    repo2.data.description = "changed description";
    const hash1 = await repo2.commit("changed desc", testAuthor);
    repo2.data.uuid = "uuid1";
    const hash2 = await repo2.commit("changed uuid", testAuthor);

    const { commits } = repo2.getHistory();
    const pendingCommit1 = commits.find((c) => c.hash === hash1);
    const pendingCommit2 = commits.find((c) => c.hash === hash2);

    const pending = repo2.cherry();

    t.equal(pending.commits.length, 2, "incorrect number of pending commits");
    t.equal(pending.refs.size, 1, "incorrect number of pending ref updates");
    t.matchOnlyStrict(
      new Set(pending.commits),
      new Set([pendingCommit2, pendingCommit1]),
      "wrong pending commits",
    );
    t.matchOnlyStrict(
      Array.from(pending.refs.keys()),
      ["refs/heads/main"],
      "wrong pending ref update",
    );
  });

  t.test("1 commit & 2 ref updates", async (t) => {
    const [repo, obj] = await getBaseline();
    updateHeaderData(obj);
    await repo.commit("header data", testAuthor);
    addOneNested(obj);
    await repo.commit("first nested", testAuthor);
    repo.tag("v0.1.0");
    const history = repo.getHistory();

    const repo2 = new Repository<ComplexObject>({}, { history });

    repo2.data.description = "changed description";
    const hash1 = await repo2.commit("changed desc", testAuthor);
    repo2.createBranch("branch2");

    const { commits } = repo2.getHistory();
    const pendingCommit1 = commits.find((c) => c.hash === hash1);

    const pending = repo2.cherry();

    t.equal(pending.commits.length, 1, "incorrect number of pending commits");
    t.equal(pending.refs.size, 2, "incorrect number of pending ref updates");
    t.matchOnlyStrict(
      pending.commits,
      [pendingCommit1],
      "wrong pending commits",
    );
    t.matchOnlyStrict(
      new Set(pending.refs.keys()),
      new Set(["refs/heads/main", "refs/heads/branch2"]),
      "wrong pending ref update",
    );
  });

  t.test("2 commit & 2 ref updates", async (t) => {
    const [repo, obj] = await getBaseline();
    updateHeaderData(obj);
    await repo.commit("header data", testAuthor);
    addOneNested(obj);
    await repo.commit("first nested", testAuthor);
    repo.tag("v0.1.0");
    const history = repo.getHistory();

    const repo2 = new Repository<ComplexObject>({}, { history });

    repo2.data.description = "changed description";
    const hash1 = await repo2.commit("changed desc", testAuthor);
    repo2.data.uuid = "uuid1";
    const hash2 = await repo2.commit("changed uuid", testAuthor);
    await repo2.checkout("branch2", true);

    const { commits } = repo2.getHistory();
    const pendingCommit1 = commits.find((c) => c.hash === hash1);
    const pendingCommit2 = commits.find((c) => c.hash === hash2);

    const pending = repo2.cherry();

    t.equal(pending.commits.length, 2, "incorrect number of pending commits");
    t.equal(pending.refs.size, 2, "incorrect number of pending ref updates");
    t.matchOnlyStrict(
      new Set(pending.commits),
      new Set([pendingCommit2, pendingCommit1]),
      "wrong pending commits",
    );
    t.matchOnlyStrict(
      new Set(pending.refs.keys()),
      new Set(["refs/heads/main", "refs/heads/branch2"]),
      "wrong pending ref update",
    );
  });

  t.test("3 commit & 2 ref updates", async (t) => {
    const [repo, obj] = await getBaseline();
    updateHeaderData(obj);
    await repo.commit("header data", testAuthor);
    addOneNested(obj);
    await repo.commit("first nested", testAuthor);
    repo.tag("v0.1.0");
    const history = repo.getHistory();

    const repo2 = new Repository<ComplexObject>({}, { history });

    repo2.data.description = "changed description";
    const hash1 = await repo2.commit("changed desc", testAuthor);
    repo2.data.uuid = "uuid1";
    const hash2 = await repo2.commit("changed uuid", testAuthor);
    await repo2.checkout("branch2", true);

    repo2.data.nested = [{ name: "a", uuid: "thing" }];
    const hash3 = await repo2.commit("added a thing", testAuthor);

    const { commits } = repo2.getHistory();
    const pendingCommit1 = commits.find((c) => c.hash === hash1);
    const pendingCommit2 = commits.find((c) => c.hash === hash2);
    const pendingCommit3 = commits.find((c) => c.hash === hash3);

    const pending = repo2.cherry();

    t.equal(pending.commits.length, 3, "incorrect number of pending commits");
    t.equal(pending.refs.size, 2, "incorrect number of pending ref updates");
    t.matchOnlyStrict(
      new Set(pending.commits),
      new Set([pendingCommit3, pendingCommit2, pendingCommit1]),
      "wrong pending commits",
    );
    t.matchOnlyStrict(
      new Set(pending.refs.keys()),
      new Set(["refs/heads/main", "refs/heads/branch2"]),
      "wrong pending ref update",
    );
  });

  t.test("3 commit & 3 ref updates", async (t) => {
    const [repo, obj] = await getBaseline();
    updateHeaderData(obj);
    await repo.commit("header data", testAuthor);
    addOneNested(obj);
    await repo.commit("first nested", testAuthor);
    repo.tag("v0.1.0");
    const history = repo.getHistory();

    const repo2 = new Repository<ComplexObject>({}, { history });

    repo2.data.description = "changed description";
    const hash1 = await repo2.commit("changed desc", testAuthor);
    repo2.data.uuid = "uuid1";
    const hash2 = await repo2.commit("changed uuid", testAuthor);
    await repo2.checkout("branch2", true);

    repo2.data.nested = [{ name: "a", uuid: "thing" }];
    const hash3 = await repo2.commit("added a thing", testAuthor);
    repo2.tag("v0.2.0");

    const { commits } = repo2.getHistory();
    const pendingCommit1 = commits.find((c) => c.hash === hash1);
    const pendingCommit2 = commits.find((c) => c.hash === hash2);
    const pendingCommit3 = commits.find((c) => c.hash === hash3);

    const pending = repo2.cherry();

    t.equal(pending.commits.length, 3, "incorrect number of pending commits");
    t.equal(pending.refs.size, 3, "incorrect number of pending ref updates");
    t.matchOnlyStrict(
      new Set(pending.commits),
      new Set([pendingCommit3, pendingCommit2, pendingCommit1]),
      "wrong pending commits",
    );
    t.matchOnlyStrict(
      new Set(pending.refs.keys()),
      new Set(["refs/heads/main", "refs/heads/branch2", "refs/tags/v0.2.0"]),
      "wrong pending ref update",
    );
  });

  t.test("after merge 1 commit & 3 ref updates", async (t) => {
    const [repo, obj] = await getBaseline();
    updateHeaderData(obj);
    await repo.commit("header data", testAuthor);
    addOneNested(obj);
    await repo.commit("first nested", testAuthor);
    repo.tag("v0.1.0");
    const history = repo.getHistory();

    const repo2 = new Repository<ComplexObject>({}, { history });
    await repo2.checkout("branch2", true);

    repo2.data.nested = [{ name: "a", uuid: "thing" }];
    const hash3 = await repo2.commit("added a thing", testAuthor);
    repo2.tag("v0.2.0");

    await repo2.checkout("main");
    await repo2.merge("branch2");

    const { commits } = repo2.getHistory();
    const pendingCommit3 = commits.find((c) => c.hash === hash3);

    const pending = repo2.cherry();

    t.equal(pending.commits.length, 1, "incorrect number of pending commits");
    t.equal(pending.refs.size, 3, "incorrect number of pending ref updates");
    t.matchOnlyStrict(
      pending.commits,
      [pendingCommit3],
      "wrong pending commits",
    );
    t.matchOnlyStrict(
      new Set(pending.refs.keys()),
      new Set(["refs/heads/main", "refs/heads/branch2", "refs/tags/v0.2.0"]),
      "wrong pending ref update",
    );
  });

  t.test("after merge 1 commit & 2 ref updates", async (t) => {
    const [repo, obj] = await getBaseline();
    updateHeaderData(obj);
    await repo.commit("header data", testAuthor);
    addOneNested(obj);
    await repo.commit("first nested", testAuthor);
    repo.tag("v0.1.0");
    const history = repo.getHistory();

    const repo2 = new Repository<ComplexObject>({}, { history });
    await repo2.checkout("branch2", true);

    repo2.data.nested = [{ name: "a", uuid: "thing" }];
    const hash3 = await repo2.commit("added a thing", testAuthor);

    await repo2.checkout("main");
    await repo2.merge("branch2");

    const { commits } = repo2.getHistory();
    const pendingCommit3 = commits.find((c) => c.hash === hash3);

    const pending = repo2.cherry();

    t.equal(pending.commits.length, 1, "incorrect number of pending commits");
    t.equal(pending.refs.size, 2, "incorrect number of pending ref updates");
    t.matchOnlyStrict(
      pending.commits,
      [pendingCommit3],
      "wrong pending commits",
    );
    t.matchOnlyStrict(
      new Set(pending.refs.keys()),
      new Set(["refs/heads/main", "refs/heads/branch2"]),
      "wrong pending ref update",
    );
  });
  t.test("no merge 1 commit & 1 ref updates", async (t) => {
    const [repo, obj] = await getBaseline();
    updateHeaderData(obj);
    await repo.commit("header data", testAuthor);
    addOneNested(obj);
    await repo.commit("first nested", testAuthor);
    repo.tag("v0.1.0");
    const history = repo.getHistory();

    const repo2 = new Repository<ComplexObject>({}, { history });
    await repo2.checkout("branch2", true);

    repo2.data.nested = [{ name: "a", uuid: "thing" }];
    const hash3 = await repo2.commit("added a thing", testAuthor);

    const { commits } = repo2.getHistory();
    const pendingCommit3 = commits.find((c) => c.hash === hash3);

    const pending = repo2.cherry();

    t.equal(pending.commits.length, 1, "incorrect number of pending commits");
    t.equal(pending.refs.size, 1, "incorrect number of pending ref updates");
    t.matchOnlyStrict(
      pending.commits,
      [pendingCommit3],
      "wrong pending commits",
    );
    t.matchOnlyStrict(
      pending.refs.keys(),
      ["refs/heads/branch2"],
      "wrong pending ref update",
    );
  });
  t.test("no merge no commit & 1 ref updates", async (t) => {
    const [repo, obj] = await getBaseline();
    updateHeaderData(obj);
    await repo.commit("header data", testAuthor);
    addOneNested(obj);
    await repo.commit("first nested", testAuthor);
    repo.tag("v0.1.0");
    const history = repo.getHistory();

    const repo2 = new Repository<ComplexObject>({}, { history });
    await repo2.checkout("branch2", true);

    const pending = repo2.cherry();

    t.equal(pending.commits.length, 0, "incorrect number of pending commits");
    t.equal(pending.refs.size, 1, "incorrect number of pending ref updates");
    t.matchOnlyStrict(pending.commits, [], "wrong pending commits");
    t.matchOnlyStrict(
      pending.refs.keys(),
      ["refs/heads/branch2"],
      "wrong pending ref update",
    );
  });
});
