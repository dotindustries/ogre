export const getSizeInBytes = (obj: string | any) => {
  let str: string;
  if (typeof obj === "string") {
    // If obj is a string, then use it
    str = obj;
  } else {
    // Else, make obj into a string
    str = JSON.stringify(obj);
  }
  // Get the length of the Uint8Array
  return new TextEncoder().encode(str).length; // in bytes
};

export const sizeInBytes = (obj: any) => {
  return getSizeInBytes(obj); // B
};

export const sizeInKilobytes = (obj: any) => {
  const bytes = getSizeInBytes(obj);
  return bytes / 1000; // kB
};

export const sizeInMegabytes = (obj: any) => {
  const bytes = getSizeInBytes(obj);
  return bytes / 1000 / 1000; // mB
};
