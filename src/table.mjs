import assert from 'node:assert'
import clone from '@ludlovian/clone'
import equal from '@ludlovian/equal'
import sortBy from '@ludlovian/sortby'
import Debug from '@ludlovian/debug'
import Row from './row.mjs'
import config from './config.mjs'
import { getSheetRange, updateSheetRange, getRangeAddress } from './google.mjs'

const customInspect = Symbol.for('nodejs.util.inspect.custom')

export default class Table {
  static types = {}

  database
  name
  #debug

  // column defs
  columns
  key

  // cells cache
  #cache = {
    cells: undefined,
    tm: undefined
  }

  afterSave
  rows = {
    index: new Map(),
    all: new Set(),
    untouched: new Set(),
    added: new Set(),
    changed: new Set(),
    deleted: new Set()
  }

  // ----------------------------------------------------
  //
  // Construction
  //

  constructor (database, name, defs) {
    assert.ok(defs && defs.name && defs.cols)
    this.database = database
    this.name = defs.name
    this.columns = parseColumns(defs.cols)
    this.key = (defs.key ?? 'rowid').split(/[ ,]/)
    this.#debug = Debug(`sheetdb:${name}`)
  }

  [customInspect] (depth, options, inspect) {
    if (depth < 0) {
      return options.stylize('[Table]', 'special')
    } else {
      return `Table{ ${options.stylize(this.name, 'string')} }`
    }
  }

  // ----------------------------------------------------
  //
  // Getters
  //

  get data () {
    return [...this.rows.all.values()]
  }

  // ----------------------------------------------------
  //
  // Public load/save API
  //

  async load (force) {
    if (force) this.#clearCache()
    const cells = this.#getCache() ?? (await this.#readCellsFromSheet())
    const rows = this.#convertCellsToRows(cells)
    this.rows.all.clear()
    this.rows.index.clear()
    // the act of getting them & updating will
    // remove duplicates
    rows.forEach(row => this.get(row).set(row))
    // now we reset the other sets
    this.#markUntouched()
    return this.data
  }

  async save (force) {
    if (force) this.#clearCache()

    // first we sort the rows
    let sortFn
    for (const colName of this.key) {
      sortFn = sortFn ? sortFn.thenBy(colName) : sortBy(colName)
    }
    const rows = this.data.sort(sortFn)

    // then convert to cells
    const cells = this.#convertRowsToCells(rows)

    const prevCells = this.#getCache() ?? (await this.#readCellsFromSheet())
    if (equal(prevCells, cells)) {
      this.#debug('No change. Skipping update of %d rows', cells.length)
    } else {
      const nBlanks = Math.max(0, prevCells.length - cells.length)
      await this.#writeCellsToSheet(cells, nBlanks)
    }
    if (this.afterSave) {
      await Promise.resolve(this.afterSave(this.rows))
    }
    this.#markUntouched()
  }

  // ----------------------------------------------------
  //
  // Finding
  //
  get_ (key) {
    if (typeof key === 'number') key = { rowid: key }
    const find = this.#seek(key)
    if (find) return find
    const row = new Row(this, key)
    this.rows.all.add(row)
    this.rows.added.add(row)
    this.#addToIndex(key, row)
    return row
  }

  #seek (keyData) {
    let ix = this.rows.index
    let nKeysLeft = this.key.length
    for (const colName of this.key) {
      const key = keyData[colName]
      if (--nKeysLeft) {
        ix = ix.get(key)
        if (!ix) return null
      } else {
        return ix.get(key)
      }
    }
  }

  #addToIndex (keyData, newValue) {
    let ix = this.rows.index
    let nKeysLeft = this.key.length
    for (const colName of this.key) {
      const key = keyData[colName]
      if (--nKeysLeft) {
        ix = ix.get(key) ?? ix.set(key, new Map()).get(key)
      } else {
        ix.set(key, newValue)
      }
    }
  }

  // ----------------------------------------------------
  //
  // Conversion Utilites
  //

  #convertCellsToRows (cells) {
    let rowid = 0
    const rows = []
    for (let i = 0; i < cells.length; i++) {
      const cellRow = cells[i]
      const data = { rowid: ++rowid }
      for (let j = 0; j < this.columns.length; j++) {
        const c = this.columns[j]
        data[c.name] = c.fromSheet(cellRow[j])
      }
      rows.push(new Row(this, data))
    }
    return rows
  }

  #convertRowsToCells (rows) {
    return rows.map(row => this.columns.map(col => col.toSheet(row[col.name])))
  }

  // ----------------------------------------------------
  //
  // Resetting change trackers
  //

  #markUntouched () {
    this.rows.untouched = new Set(this.data)
    this.rows.added.clear()
    this.rows.changed.clear()
    this.rows.deleted.clear()
  }

  // ----------------------------------------------------
  //
  // Cache of recently loaded cells
  //

  #getCache () {
    if (!this.#cache.cells) return undefined
    if (Date.now() - this.#cache.tm > config.cacheTime) {
      this.#clearCache()
      return undefined
    }
    return this.#cache.cells
  }

  #clearCache () {
    this.#cache.cells = this.#cache.tm = undefined
  }

  #storeCache (cells) {
    this.#cache.cells = clone(cells)
    this.#cache.tm = Date.now()
    return cells
  }

  // ----------------------------------------------------
  //
  // Loading & saving of cells from sheet
  //

  async #readCellsFromSheet () {
    const nCols = this.columns.length
    const range = this.name + '!' + getRangeAddress(2, 1, Infinity, nCols)
    let cells = await this.database.exec(() =>
      getSheetRange({
        spreadsheetId: this.database.spreadsheetId,
        range
      })
    )
    cells = normaliseCells(cells, nCols)
    this.#debug('%d rows loaded', cells.length)
    return this.#storeCache(cells)
  }

  async #writeCellsToSheet (cells, blankRows) {
    blankRows = Math.max(0, blankRows)
    const nCols = this.columns.length
    const trailer = Array.from({ length: blankRows }, () =>
      Array.from({ length: nCols }, () => '')
    )

    const range =
      this.name +
      '!' +
      getRangeAddress(2, 1, cells.length + trailer.length, nCols)
    await this.database.exec(() =>
      updateSheetRange({
        spreadsheetId: this.database.spreadsheetId,
        range,
        data: [...cells, ...trailer]
      })
    )
    this.#storeCache(cells)
    this.#debug('%d rows written', cells.length)
  }
}
Table.prototype.get = Table.prototype.get_

// ----------------------------------------------------
//
// Cell sanitising
//

function normaliseCells (cells, nCols) {
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

function parseColumns (colDefs) {
  const cols = []
  for (const colDef of colDefs.split(/[, ]/)) {
    const [name, colType = 'string'] = colDef.split(':')
    assert.ok(Table.types[colType])
    cols.push({
      name,
      type: colType,
      ...Table.types[colType]
    })
  }
  return cols
}
