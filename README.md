# sheetdb
Database with Google Sheet backend

## Database

A named export as well as the default.

A class representing a google sheet database

### new Database (spreadsheetId)

Creates a new database

### .addTable(name, defs)

Adds a new table to the database. Definitions are:
- `name`: the sheet name in the google spreadsheet
- `columns`: String. Comma/space delimited list of column defintions
- `sort`: Optional string. Comma/space delimited list of columns to sort on

Column definitions are `<name>[:<type>]`. Types can be:
- `string` (also the default if not given
- `number`
- `date`
- `money` (aka Decimal with precision 2)

### .tables

An object with all the defined tables under it

## Table

Created by `database.addTable`, this represents a sheet of data

### .database

The owning `Database`

### async .load() => data

Loads the data.

### .data

The current data.

### async .save([data], force)

Saves the given data (or `.data`) to the table

If `force` is truthy, it will bypass the cache and reload the table
before writing to it.
