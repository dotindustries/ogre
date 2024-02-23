import { test } from "tap";
import { getBaseline, testAuthor } from "./test.utils";

test("cannot tag on an empty repo", async (t) => {
  const [repo] = await getBaseline();

  t.throws(
    () => {
      repo.tag("v1.0.0");
    },
    { message: `fatal: failed to resolve 'HEAD' as a valid ref.` },
  );
});

test("can create simple tag pointing to HEAD", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "name";
  const commit = await repo.commit("initial commit", testAuthor);
  const tag = "v1.0.0";

  const tagRef = repo.tag(tag);

  let expectedRefKey = `refs/tags/${tag}`;
  t.equal(tagRef, expectedRefKey);
  t.equal(repo.ref(tagRef), commit, "tag is not pointing to expected commit");
  const { refs } = repo.getHistory();
  t.ok(refs.has(expectedRefKey), "reference was not present in history");
});

test("cannot create tag with whitespace", async (t) => {
  const [repo] = await getBaseline();
  repo.data.name = "name";
  await repo.commit("initial commit", testAuthor);
  const tag = "first release";

  t.throws(
    () => {
      repo.tag(tag);
    },
    { message: `fatal: '${tag}' is not a valid tag name` },
  );
});
