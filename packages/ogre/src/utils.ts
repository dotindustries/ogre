// [RFC5322](https://www.ietf.org/rfc/rfc5322.txt)
const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/

export const cleanAuthor = (author: string): [name: string, email: string] => {
  if (author === '') {
    throw new Error(`author not provided`)
  }
  // author name <email>
  let strings = author.split(' <')
  if (strings.length > 1) {
    return [strings[0], strings[1].replace('>', '')]
  }
  // author name @handle
  strings = author.split(' @')
  if (strings.length > 1) {
    return [strings[0], `@${strings[1]}`]
  }
  // email@domain.com
  if (emailRegex.test(author)) {
    return ['', author]
  }
  // unrecognized format
  return [author, '']
}
