export const getSizeInBytes = (obj: string | any) => {
  let str: string
  if (typeof obj === 'string') {
    // If obj is a string, then use it
    str = obj
  } else {
    // Else, make obj into a string
    str = JSON.stringify(obj)
  }
  // Get the length of the Uint8Array
  return new TextEncoder().encode(str).length // in bytes
}

export const logSizeInBytes = (description: string, obj: any) => {
  const bytes = getSizeInBytes(obj)
  console.log(`${description} is approximately ${bytes} B`)
}

export const logSizeInKilobytes = (description: string, obj: any) => {
  const bytes = getSizeInBytes(obj)
  const kb = (bytes / 1000).toFixed(2)
  console.log(`${description} is approximately ${kb} kB`)
}

export const logSizeInMegabytes = (description: string, obj: any) => {
  const bytes = getSizeInBytes(obj)
  const mb = (bytes / 1000 / 1000).toFixed(2)
  console.log(`${description} is approximately ${mb} mB`)
}
