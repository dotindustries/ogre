const bad = /(^|[/.])([/.]|$)|^@$|@{|[\x00-\x20\x7f~^:?*[\\]|\.lock(\/|$)/
const badBranch = /^(-|HEAD$)/

export function validRef (name: string, onelevel: boolean) {
  return !bad.test(name) && (onelevel || name.includes('/'))
}

export function validBranch (name: string) {
  return validRef(name, true) && !badBranch.test(name)
}
