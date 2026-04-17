export function readCookie(cookieHeader: string, name: string): string | null {
  const pair = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!pair) {
    return null;
  }

  return pair.slice(name.length + 1);
}
