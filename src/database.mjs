import Lock from '@ludlovian/lock'
import Debug from '@ludlovian/debug'
import Table from './table.mjs'

export class Database {
  #spreadsheetId
  #lock = new Lock()
  #tables = {}
  #debug = Debug('sheetdb:database')

  constructor (spreadsheetId) {
    this.#spreadsheetId = spreadsheetId
  }

  get exec () {
    return this.#lock.exec
  }

  get spreadsheetId () {
    return this.#spreadsheetId
  }

  get tables () {
    return this.#tables
  }

  addTable (name, defs) {
    this.#tables[name] = new Table(this, name, defs)
    this.#debug('Added %s', name)
    return this
  }
}
