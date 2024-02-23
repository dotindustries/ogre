import { test } from "tap";
import { cleanAuthor } from "./utils";

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
