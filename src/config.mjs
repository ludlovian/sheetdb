import configure from '@ludlovian/configure'

export default configure('SHEETDB_', {
  cacheTime: '2m',
  credsFile: 'creds/credentials.json'
})
