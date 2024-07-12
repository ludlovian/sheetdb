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
- `columns`: String. Comma delimited list of column defintions
- `key`: String. Comma delimited list of the primary key. If omitted then 1-based `rowid` will be used

Column definitions are `<name>[:<type>]`. Types can be:
- `string` (also the default if not given
- `number`
- `date`
- `money` (aka Decimal with precision 2)

### .tables

An object with all the defined tables under it

---

## Table

Created by `database.addTable`, this represents a sheet of data

### .database

The owning `Database`

### async .load(force)

Loads the data. If force is truthy, then we will not use the cache of cells

### async .save(force)

Saves the data. If force is truthy, then we will not use the cache of cells

### .data

All the current rows ( a synonym for `[....rows.all]` )

### .rows

An object with Sets as follows
- `all`: all the Rows
- `untouched`: Rows which have not been touched since the last load
- `added`: Rows which have been added
- `changed`: Rows which have actually been updated (not just `.set`)
- `deleted`: Rows which have been deleted

### .get(key)

Returns the row matching this primary key. WIll add a new one if needed.

An integer is a shortcut for { rowid } for tables with that the primary key

---

## Row

These are the rows of data.

### .set(data)

Updates the row with this data, but only if changed.

### .delete()

Removes the row from the table.
