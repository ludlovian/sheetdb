import { suite, test, before } from 'node:test'
import assert from 'node:assert/strict'
import decimal from '@ludlovian/decimal'

import Database from '../src/index.mjs'

const spreadsheetId = '11py3fCC326GoQBbBIQpaqdLswk-C4MD059sB8z97044'

suite('Database', { concurrency: false }, () => {
  let db
  before(() => {
    db = new Database(spreadsheetId)
    db.addTable('stocks', {
      name: 'Stocks',
      cols: 'ticker,name,incomeType,notes,ccy,factor:number',
      sort: 'ticker'
    })
    db.addTable('trades', {
      name: 'Trades',
      cols:
        'ticker,account,who,date:date,qty:number,cost:money,gain:money,proceeds:money,notes',
      sort: 'date,who,account,ticker'
    })
    db.addTable('positions', {
      name: 'Positions',
      cols: 'ticker,account,who,qty:number',
      sort: 'ticker,account,who',
      unique: 'ticker,account,who'
    })
  })

  test('Read table', async () => {
    const table = db.tables.stocks
    await table.load()

    table.data.forEach(row => {
      assert.ok(typeof row.ticker === 'string')
      assert.ok(row.factor === undefined || typeof row.factor === 'number')
    })
  })

  test('Read table with numbers, dates and money', async () => {
    const table = db.tables.trades
    await table.load()

    table.data.forEach(row => {
      assert.ok(row.qty === undefined || typeof row.qty === 'number')
      assert.ok(row.cost === undefined || decimal.isDecimal(row.cost))
      assert.ok(row.date === undefined || row.date instanceof Date)
    })
  })

  test('update table', async () => {
    const table = db.tables.trades
    table.data[0].notes = 'blah'
    await table.save()

    await table.save(table.data)
    table.data[0].notes = undefined

    await table.save(table.data, 'force')
  })

  test('unique rows', async () => {
    const table = db.tables.positions
    await table.load()
    const ticker = 'zzz'
    const who = 'pix'
    const account = 'pix'
    table.data.push({ ticker, account, who, qty: 111 })
    table.data.push({ ticker, account, who, qty: 222 })
    await table.save()

    assert.ok((table.data.filter(r => r.who === who).length = 1))
  })
})
