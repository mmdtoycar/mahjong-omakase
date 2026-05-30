import { test, expect, describe } from 'vitest'
import { fanTableData } from '../../../data/fanTableData'
import { Tile } from '../tiles'
import { calculateBestScore } from '../fan'
declare module 'fs' {
  export function readFileSync(path: string, options: string): string
  export function readdirSync(path: string): string[]
}
declare module 'path' {
  export function join(...paths: string[]): string
}
declare const __dirname: string

import fs from 'fs'
import path from 'path'

describe('Guobiao Test Integrity Check', () => {
  test('Ensure every one of the 81 official fan types has at least one unit test case', () => {
    // 1. Get all fan names from the UI data file
    const fanNames = fanTableData.map((f) => f.name)
    expect(fanNames.length).toBe(81)

    // 2. Discover and read other test files in the same directory dynamically
    const testDir = __dirname
    const testFiles = fs
      .readdirSync(testDir)
      .filter((file) => file.endsWith('.test.ts') && file !== 'integrity.test.ts')

    expect(testFiles.length, 'No other test files discovered for integrity check').toBeGreaterThan(0)

    const testContents = testFiles
      .map((file) => {
        const filePath = path.join(testDir, file)
        return fs.readFileSync(filePath, 'utf8')
      })
      .join('\n')

    // 3. Check for coverage of each fan name using quote/delimiter boundaries to prevent substring false positives
    const missing: string[] = []
    for (const name of fanNames) {
      const singleQuoted = `'${name}'`
      const doubleQuoted = `"${name}"`
      const backtickQuoted = `\`${name}\``
      if (
        !testContents.includes(singleQuoted) &&
        !testContents.includes(doubleQuoted) &&
        !testContents.includes(backtickQuoted)
      ) {
        missing.push(name)
      }
    }

    expect(missing, `The following fan types lack test coverage: ${missing.join(', ')}`).toEqual([])
  })
})
