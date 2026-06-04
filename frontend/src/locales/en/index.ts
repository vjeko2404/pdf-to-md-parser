/** Index barrel for the English locale: imports every namespace JSON and exposes
 *  them as one resource bundle. Adding a namespace = drop a `<name>.json` here and
 *  add the line below — `i18n.ts` only ever imports this barrel, never the raw JSON. */
import common from './common.json'
import nav from './nav.json'
import auth from './auth.json'
import library from './library.json'
import document from './document.json'
import settings from './settings.json'
import ai from './ai.json'
import categories from './categories.json'
import folders from './folders.json'
import logs from './logs.json'
import secrets from './secrets.json'
import admin from './admin.json'
import apiErrors from './apiErrors.json'

export const en = {
  common,
  nav,
  auth,
  library,
  document,
  settings,
  ai,
  categories,
  folders,
  logs,
  secrets,
  admin,
  apiErrors,
}

/** Ordered list of namespaces — registered with i18next so any can be loaded. */
export const NAMESPACES = Object.keys(en) as (keyof typeof en)[]

export default en
