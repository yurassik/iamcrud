export function getUnixTime(time: Date) {
  return Math.floor(time.getTime() / 1000);
}

export function unixTimeToDate(unixTime: number) {
  return new Date(unixTime * 1000);
}
