// Retire les appels pgPolicy(...) du schéma généré par drizzle-kit pull (voir post-pull.sh, étape 9).
// Les appels peuvent tenir sur plusieurs lignes (gabarits sql`...`) : parcours avec parenthèses équilibrées.
import { readFileSync, writeFileSync } from 'node:fs'

const file = process.argv[2]
const src = readFileSync(file, 'utf8')
const marker = '\tpgPolicy('
let out = ''
let i = 0
for (;;) {
  const start = src.indexOf(marker, i)
  if (start === -1) {
    out += src.slice(i)
    break
  }
  out += src.slice(i, start)
  let j = start + marker.length
  let depth = 1
  let quote = null
  for (; depth > 0; j++) {
    const c = src[j]
    if (c === undefined) throw new Error(`strip-policies: appel pgPolicy non fermé (position ${start})`)
    if (quote) {
      if (c === '\\') j++
      else if (c === quote) quote = null
      continue
    }
    if (c === '`' || c === '"') quote = c
    else if (c === '(') depth++
    else if (c === ')') depth--
  }
  if (src[j] === ',') j++
  if (src[j] === '\n') j++
  i = j
}
writeFileSync(file, out.replace(/, pgPolicy(?=[ ,])/, ''))
