/** Does this spreadsheet column header mean "house / flat number"? Residents'
 *  registers name it many ways: "House No", "Flat", "House Name/No", and in some
 *  societies "GR No" (the plot/house register number). Matched on the lower-cased
 *  header text. Shared by the resident and directory imports so they agree. */
export function isHouseHeader(label: string): boolean {
  if (/house|flat|plot|villa|unit|door/.test(label)) return true;
  // "GR No", "GR. No.", "G R Number", "GR" — but not words that merely start with
  // those letters ("grade", "group").
  return /^g\.?\s?r\.?(?![a-z])/.test(label);
}
