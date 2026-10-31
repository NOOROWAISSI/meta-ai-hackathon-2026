/** Contract instants have an explicit, known offset; calendar dates have no instant. */
export function isContractDate(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}
export function isContractInstant(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 40 || value.endsWith("-00:00")) return false;
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,7})?(Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match || match[0] !== value || !isContractDate(match[1])) return false;
  if (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return false;
  if (
    match[5] !== "Z" &&
    (Number(match[6]) > 14 ||
      Number(match[7]) > 59 ||
      (Number(match[6]) === 14 && Number(match[7]) !== 0))
  )
    return false;
  const instant = Date.parse(value);
  return (
    Number.isFinite(instant) &&
    instant >= Date.parse("0001-01-01T00:00:00Z") &&
    instant <= Date.parse("9999-12-31T23:59:59.999Z")
  );
}
export function formatContractInstant(value: string, timeZone: string, locale = "en-US"): string {
  if (!isContractInstant(value))
    throw new Error("An explicit-offset contract instant is required.");
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
