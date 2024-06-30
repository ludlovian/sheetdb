import process from 'node:process'
import Debug from '@ludlovian/debug'
import config from './config.mjs'

const debug = Debug('sheetdb:google')
const scopes = ['https://www.googleapis.com/auth/spreadsheets']

let _sheetApi

async function getSheetApi () {
  if (_sheetApi) return _sheetApi

  const sheetsApi = await import('@googleapis/sheets')
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??= config.credsFile
  const auth = new sheetsApi.auth.GoogleAuth({ scopes })
  const authClient = await auth.getClient()
  _sheetApi = sheetsApi.sheets({ version: 'v4', auth: authClient })
  debug('Sheets API loaded')
  return _sheetApi
}

export async function getSheetRange ({ spreadsheetId, range }) {
  const sheets = _sheetApi ?? (await getSheetApi())

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
    majorDimension: 'ROWS'
  })

  // defensive
  /* c8 ignore start */
  if (response.status !== 200) {
    throw Object.assign(new Error('Failed to read sheet'), { response })
  }
  /* c8 ignore stop */
  return response.data.values
}

export async function updateSheetRange ({ spreadsheetId, range, data }) {
  const sheets = _sheetApi ?? (await getSheetApi())

  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      range,
      majorDimension: 'ROWS',
      values: data
    }
  })

  // defensive
  /* c8 ignore start */
  if (response.status !== 200) {
    throw Object.assign(new Error('Failed to update sheet'), { response })
  }
  /* c8 ignore stop */
}

export function getColumnName (col) {
  // Convert a column number (1, 2, ..., 26, 27, ...)
  // into a column name (A, B, ..., Z, AA, ...)
  //
  // inspired by bb26
  //
  const toChar = n => String.fromCharCode(64 + n)
  let s = ''
  for (let n = col; n > 0; n = Math.floor(--n / 26)) {
    s = toChar(n % 26 || 26) + s
  }
  return s
}

export function getCellAddress (row, col) {
  return getColumnName(col) + (row === Infinity ? '' : row.toString())
}

export function getRangeAddress (top, left, height, width) {
  const right = left + width - 1
  const bottom = top + height - 1
  return `${getCellAddress(top, left)}:${getCellAddress(bottom, right)}`
}
