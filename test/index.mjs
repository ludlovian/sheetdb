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
      key: 'ticker'
    })
    db.addTable('trades', {
      name: 'Trades',
      cols:
        'ticker,account,who,date:date,qty:number,cost:money,gain:money,proceeds:money,notes'
    })
    db.addTable('positions', {
      name: 'Positions',
      cols: 'ticker,account,who,qty:number',
      key: 'ticker,account,who'
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
    const table = db.tables.stocks
    await table.load()
    table.get({ ticker: 'NCYF' }).set({ notes: 'the OG' })
    await table.save()
    await table.save()
    table.get({ ticker: 'NCYF' }).set({ notes: undefined })
    await table.save('force')
  })
})
