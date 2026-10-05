#!/usr/bin/env node
// Replace `text()` calls on lines marked with customType comments (bytea, citext, tstzrange)
// with proper customType calls imported from './custom-types.js'.
//
// Input: path to schema.ts
// Run after unknown→text replacement and after bytea/citext/tstzrange comment markers are added.

import { readFileSync, writeFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('Usage: replace-custom-types.mjs <schema.ts>')
  process.exit(1)
}

let src = readFileSync(file, 'utf8')
const lines = src.split('\n')
const result = []
const usedTypes = new Set()

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]

  // Detect marker comments and replace the NEXT line's text() with the proper customType call.
  const markerMatch = line.match(
    /\/\/ customType: (bytea|citext|tstzrange)/,
  )
  if (markerMatch && i + 1 < lines.length) {
    const typeName = markerMatch[1]
    usedTypes.add(typeName)
    // Replace text( with the customType function name (bytea|citext|tstzrange)(
    const nextLine = lines[i + 1]
    const replaced = nextLine.replace(/\btext\(/, `${typeName}(`)
    result.push(line.replace(
      /customType: (bytea|citext|tstzrange) \(mapped to text;[^)]*\)/,
      `customType: ${typeName}`,
    ))
    result.push(replaced)
    i++ // skip the next line, we already handled it
    continue
  }

  result.push(line)
}

// Add import for used customTypes at the top (after the @ts-nocheck line and existing imports)
if (usedTypes.size > 0) {
  const importLine = `import { ${[...usedTypes].sort().join(', ')} } from './custom-types.js'`
  // Insert after the first import block
  const importIdx = result.findIndex(
    (l, idx) => idx > 0 && !l.startsWith('import ') && !l.startsWith('// @ts-nocheck'),
  )
  if (importIdx > 0) {
    result.splice(importIdx, 0, importLine)
  }
}

writeFileSync(file, result.join('\n'))

const count = usedTypes.size
console.log(
  `replace-custom-types: ${count} type(s) replaced (${[...usedTypes].join(', ')})`,
)
