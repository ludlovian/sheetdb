import assert from 'node:assert'
import decimal from '@ludlovian/decimal'
import clone from '@ludlovian/clone'
import equal from '@ludlovian/equal'
import sortBy from '@ludlovian/sortby'
import Debug from '@ludlovian/debug'
import { toSerial, toDate } from './serial-date.mjs'
import config from './config.mjs'
import { getSheetRange, updateSheetRange, getRangeAddress } from './google.mjs'

export default class Table {
  #database
  #name
  #sheetName
  #columns
  #sortFunction
  data
  #lastCells
  #lastCellsTime
  #debug

  constructor (database, name, defs) {
    assert.ok(defs && defs.name && defs.cols)
    this.#database = database
    this.#sheetName = defs.name
    this.#columns = Table.#parseColumns(defs.cols)
    this.#sortFunction = Table.#parseSortFunction(defs.sort)
    this.#debug = Debug(`sheetdb:${name}`)
  }

  get database () {
    return this.#database
  }

  get columns () {
    return this.#columns.map(({ name, type }) => ({ name, type }))
  }

  static #parseColumns (colDefs) {
    const cols = []
    for (const colDef of colDefs.split(/[, ]/)) {
      const [name, colType = 'string'] = colDef.split(':')
      assert.ok(COL_TYPES[colType])
      cols.push({
        name,
        type: colType,
        ...COL_TYPES[colType]
      })
    }
    return cols
  }

  static #parseSortFunction (sort) {
    let fn
    for (const col of (sort ?? '').split(',')) {
      if (col) {
        fn = !fn ? sortBy(col) : fn.thenBy(col)
      }
    }
    return fn
  }

  static #normaliseCells (cells, nCols) {
    const blankRow = Array.from({ length: nCols }, () => '')
    cells = cells ?? []
    for (let i = 0; i < cells.length; i++) {
      const row = cells[i]
      if (row.length < nCols) {
        cells[i] = [...row, ...blankRow].slice(0, nCols)
      }
    }

    const lastRowEmpty = () =>
      cells.length && cells[cells.length - 1].every(x => x === '')

    while (lastRowEmpty()) {
      cells.pop()
    }
    return cells
  }

  #getCache () {
    if (!this.#lastCells) return undefined
    if (Date.now() - this.#lastCellsTime > config.cacheTime) {
      this.#clearCache()
      return undefined
    }
    return this.#lastCells
  }

  #clearCache () {
    this.#lastCells = this.#lastCellsTime = undefined
  }

  #storeCache (cells) {
    this.#lastCells = clone(cells)
    this.#lastCellsTime = Date.now()
    return cells
  }

  async #loadCells () {
    const nCols = this.#columns.length
    const range = this.#sheetName + '!' + getRangeAddress(2, 1, Infinity, nCols)
    let cells = await this.database.exec(() =>
      getSheetRange({
        spreadsheetId: this.database.spreadsheetId,
        range
      })
    )
    cells = Table.#normaliseCells(cells, nCols)
    this.#debug('%d rows loaded', cells.length)
    return this.#storeCache(cells)
  }

  async #saveCells (cells, blankRows) {
    blankRows = Math.max(0, blankRows)
    const nCols = this.#columns.length
    const trailer = Array.from({ length: blankRows }, () =>
      Array.from({ length: nCols }, () => '')
    )

    const range =
      this.#sheetName +
      '!' +
      getRangeAddress(2, 1, cells.length + trailer.length, nCols)
    await this.database.exec(() =>
      updateSheetRange({
        spreadsheetId: this.database.spreadsheetId,
        range,
        data: [...cells, ...trailer]
      })
    )
    this.#debug('%d rows written', cells.length)
  }

  async load () {
    const cells = this.#getCache() ?? (await this.#loadCells())
    this.data = cells.map(row =>
      Object.fromEntries(
        row.map((cell, ix) => {
          const col = this.#columns[ix]
          return [col.name, col.fromSheet(cell)]
        })
      )
    )
    return this.data
  }

  async save (data, force) {
    if (force) this.#clearCache()
    this.data = data ?? this.data
    if (this.#sortFunction) {
      this.data = this.data.sort(this.#sortFunction)
    }
    const cells = this.data.map(row =>
      this.#columns.map(col => col.toSheet(row[col.name]))
    )
    const prevCells = this.#getCache() ?? (await this.#loadCells())
    if (equal(prevCells, cells)) {
      this.#debug('No change. Skipping update of %d rows', cells.length)
      return
    }

    this.#storeCache(cells)
    const nBlanks = Math.max(0, prevCells.length - cells.length)
    await this.#saveCells(cells, nBlanks)
  }
}

const COL_TYPES = {
  string: {
    toSheet: x => (x === undefined ? '' : x + ''),
    fromSheet: x => (x === '' ? undefined : x)
  },
  number: {
    toSheet: x => (x === undefined ? '' : x),
    fromSheet: x => (x === '' ? undefined : x)
  },
  date: {
    toSheet: x => (x === undefined ? '' : toSerial(x)),
    fromSheet: x => (x === '' ? undefined : toDate(x))
  },
  money: {
    toSheet: x => (x === undefined ? '' : Number(x.toString())),
    fromSheet: x => (x === '' ? undefined : decimal(x).withPrecision(2))
  }
}
