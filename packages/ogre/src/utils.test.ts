import { test } from "tap";
import { cleanAuthor, mapPath, shaishToCommit } from "./utils.js";
import { Repository } from "./repository.js";
import {type ComplexObject, testAuthor } from "./test.utils.js";

test("author <email@domain.info>", (t) => {
  const [name, email] = cleanAuthor("author <email@domain.info>");
  t.equal(name, "author");
  t.equal(email, "email@domain.info");
  t.end();
});

test("author with space <email@domain.info>", (t) => {
  const [name, email] = cleanAuthor("author with space <email@domain.info>");
  t.equal(name, "author with space");
  t.equal(email, "email@domain.info");
  t.end();
});

test("author @handle", (t) => {
  const [name, email] = cleanAuthor("author @handle");
  t.equal(name, "author");
  t.equal(email, "@handle");
  t.end();
});

test("author with space @handle", (t) => {
  const [name, email] = cleanAuthor("author with space @handle");
  t.equal(name, "author with space");
  t.equal(email, "@handle");
  t.end();
});

test("email@domain.info", (t) => {
  const [name, email] = cleanAuthor("email@domain.info");
  t.equal(name, "");
  t.equal(email, "email@domain.info");
  t.end();
});

test("@handle", (t) => {
  const [name, email] = cleanAuthor("@handle");
  t.equal(name, "@handle");
  t.equal(email, "");
  t.end();
});

test("empty author", (t) => {
  t.throws(
    () => {
      cleanAuthor("");
    },
    { message: "author not provided" },
  );
  t.end();
});

test("mapPath", async (t) => {
  t.test("find root", async (t) => {
    const repo = new Repository<ComplexObject>({}, {});
    repo.data.name = "name";
    const hash = await repo.commit("set name", testAuthor);

    const { commits, refs } = repo.getHistory();
    const [c] = shaishToCommit(hash, refs, commits);
    const [isAncestor, path] = mapPath(commits, c);
    t.equal(path.length, 1, "path does not contain 1 commit");
    t.equal(isAncestor, true, "root is not ancestor of commit");
    t.matchOnlyStrict(path[0], c, "path does not contain the right commit");
  });

  t.test("finds full path to root", async (t) => {
    const repo = new Repository<ComplexObject>({}, {});
    repo.data.name = "name";
    const h1 = await repo.commit("set name", testAuthor);
    repo.data.description = "description";
    const h2 = await repo.commit("set desc", testAuthor);

    const { commits, refs } = repo.getHistory();
    const [c1] = shaishToCommit(h1, refs, commits);
    const [c2] = shaishToCommit(h2, refs, commits);
    const [isAncestor, path] = mapPath(commits, c2);

    t.equal(path.length, 2, "path does not contain 1 commit");
    t.equal(isAncestor, true, "root is not ancestor of commit");
    t.matchOnlyStrict(
      path[0],
      c2,
      "path does not contain the right commit at 0",
    );
    t.matchOnlyStrict(
      path[1],
      c1,
      "path does not contain the right commit at 1",
    );
  });

  t.test("parent-to-child no ancestor", async (t) => {
    const repo = new Repository<ComplexObject>({}, {});
    repo.data.name = "name";
    const h1 = await repo.commit("set name", testAuthor);
    repo.data.description = "description";
    const h2 = await repo.commit("set desc", testAuthor);

    const { commits, refs } = repo.getHistory();
    const [c1] = shaishToCommit(h1, refs, commits);
    const [c2] = shaishToCommit(h2, refs, commits);
    const [isAncestor, path] = mapPath(commits, c1, c2);

    t.equal(path.length, 0, "path contains a commit");
    t.equal(isAncestor, false, "child must not be an ancestor of parent");
  });

  t.test("finds path across 2 branches", async (t) => {
    const repo = new Repository<ComplexObject>({}, {});
    repo.data.name = "name";
    const h1 = await repo.commit("set name", testAuthor);
    repo.checkout("branch", true);

    repo.data.description = "description";
    const h2 = await repo.commit("set desc", testAuthor);

    const { commits, refs } = repo.getHistory();
    const [c1] = shaishToCommit(h1, refs, commits);
    const [c2] = shaishToCommit(h2, refs, commits);
    const [isAncestor, path] = mapPath(commits, c2);

    t.equal(path.length, 2, "path does not contain 1 commit");
    t.equal(isAncestor, true, "root is not ancestor of commit");
    t.matchOnlyStrict(
      path[0],
      c2,
      "path does not contain the right commit at 0",
    );
    t.matchOnlyStrict(
      path[1],
      c1,
      "path does not contain the right commit at 1",
    );
  });
});
