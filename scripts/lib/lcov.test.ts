import { describe, expect, it } from 'bun:test'
import { parseLcov, percent, summarize, toMarkdown } from './lcov'

const sample = [
  'TN:',
  'SF:src\\app.ts',
  'FNF:2',
  'FNH:1',
  'DA:1,3',
  'LF:10',
  'LH:6',
  'end_of_record',
  'SF:app/pages/index.vue',
  'FNF:1',
  'FNH:1',
  'BRF:4',
  'BRH:2',
  'LF:5',
  'LH:5',
  'end_of_record',
].join('\n')

describe('parseLcov', () => {
  it('reads one record per end_of_record and normalizes Windows paths', () => {
    expect(parseLcov(sample)).toEqual([
      { file: 'src/app.ts', linesFound: 10, linesHit: 6, functionsFound: 2, functionsHit: 1 },
      {
        file: 'app/pages/index.vue',
        linesFound: 5,
        linesHit: 5,
        functionsFound: 1,
        functionsHit: 1,
      },
    ])
  })

  it('ignores unknown keys, CRLF and records without SF', () => {
    expect(
      parseLcov('BRF:1\r\nend_of_record\r\nSF:a.ts\r\nLF:1\r\nLH:1\r\nend_of_record\r\n'),
    ).toEqual([{ file: 'a.ts', linesFound: 1, linesHit: 1, functionsFound: 0, functionsHit: 0 }])
  })

  it('returns [] for empty input', () => {
    expect(parseLcov('')).toEqual([])
  })
})

describe('summarize', () => {
  it('sums lines and functions across files', () => {
    expect(summarize(parseLcov(sample))).toEqual({
      files: 2,
      linesFound: 15,
      linesHit: 11,
      functionsFound: 3,
      functionsHit: 2,
    })
  })
})

describe('percent', () => {
  it.each([
    [11, 15, '73.3%'],
    [5, 5, '100.0%'],
    [0, 0, '—'],
  ])('percent(%i, %i) → %s', (hit, found, expected) => {
    expect(percent(hit, found)).toBe(expected)
  })
})

describe('toMarkdown', () => {
  it('renders a GFM table with one row per workspace', () => {
    const md = toMarkdown([{ name: 'api', summary: summarize(parseLcov(sample)) }])
    expect(md.split('\n')).toEqual([
      '| Workspace | Lines | Functions | Files |',
      '| --------- | ----- | --------- | ----- |',
      '| api | 73.3% (11/15) | 66.7% (2/3) | 2 |',
    ])
  })
})
