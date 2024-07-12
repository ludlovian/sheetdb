import('./src/index.mjs')
  .then(mod => {
    global.Database = mod.Database
    global.spreadsheetId = '11py3fCC326GoQBbBIQpaqdLswk-C4MD059sB8z97044'
    console.log('Database loaded')
  })
