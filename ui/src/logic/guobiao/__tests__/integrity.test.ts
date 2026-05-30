import { test, expect, describe } from 'vitest'
import { fanTableData } from '../../../data/fanTableData'
import { Tile } from '../tiles'
import { calculateBestScore } from '../fan'
import fs from 'fs'
import path from 'path'

describe('Guobiao Test Integrity Check', () => {
  test('Ensure every one of the 81 official fan types has at least one unit test case', () => {
    // 1. Get all fan names from the UI data file
    const fanNames = fanTableData.map((f) => f.name)
    expect(fanNames.length).toBe(81)

    // 2. Read other test files in the same directory
    const testDir = __dirname
    const testFiles = [
      'rules.test.ts',
      'comprehensive.test.ts',
      'reference.test.ts',
      'bugfix.test.ts',
      'benchmark.test.ts',
    ]

    const testContents = testFiles
      .map((file) => {
        const filePath = path.join(testDir, file)
        return fs.readFileSync(filePath, 'utf8')
      })
      .join('\n')

    // 3. Check for coverage of each fan name
    const missing: string[] = []
    for (const name of fanNames) {
      if (!testContents.includes(name)) {
        missing.push(name)
      }
    }

    expect(missing, `The following fan types lack test coverage: ${missing.join(', ')}`).toEqual([])
  })
})
