import equal from '@ludlovian/equal'

export default class Row {
  #table
  constructor (table, data = {}) {
    this.#table = table
    const defs = Object.fromEntries(
      table.columns.map(col => [
        col.name,
        {
          value: data[col.name],
          enumerable: true,
          writable: true
        }
      ])
    )
    defs.rowid = { value: data.rowid }
    table.key.forEach(colName => {
      defs[colName].writable = false
    })
    Object.defineProperties(this, defs)
  }

  delete () {
    const rows = this.#table.rows
    if (rows.all.has(this)) {
      rows.untouched.delete(this)
      rows.changed.delete(this)
      rows.all.delete(this)
      rows.deleted.add(this)
    }
  }

  set_ (newData) {
    let changed = false
    const rows = this.#table.rows
    for (const k in newData) {
      if (k in this && !equal(this[k], newData[k])) {
        this[k] = newData[k]
        changed = true
      }
    }
    if (rows.all.has(this)) {
      if (changed && !rows.added.has(this)) {
        rows.changed.add(this)
      }
      rows.untouched.delete(this)
    }
  }
}
Row.prototype.set = Row.prototype.set_
