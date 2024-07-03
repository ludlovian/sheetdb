import { Database } from './database.mjs'
import { getSheetRange } from './google.mjs'
import { toDate, toSerial } from './serial-date.mjs'

function readSheet (spreadsheetId, range) {
  if (!range.includes('!')) range += '!A1:ZZ9999'
  return getSheetRange({ spreadsheetId, range })
}

export default Database
export { Database, readSheet, toDate, toSerial }
