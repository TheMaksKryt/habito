// Парсер lcov и сводка покрытия. Чистые функции без I/O — тестируются напрямую
// (scripts/lib/lcov.test.ts). Оба раннера (bun test, Vitest v8) пишут одинаковые
// ключи: SF (файл), LF/LH (строки всего/покрыто), FNF/FNH (функции), end_of_record.
// Branch-метрик нет: bun их не пишет.

export type LcovRecord = {
  file: string
  linesFound: number
  linesHit: number
  functionsFound: number
  functionsHit: number
}

export type CoverageSummary = {
  files: number
  linesFound: number
  linesHit: number
  functionsFound: number
  functionsHit: number
}

const EMPTY = (): LcovRecord => ({
  file: '',
  linesFound: 0,
  linesHit: 0,
  functionsFound: 0,
  functionsHit: 0,
})

// SF у bun на Windows с бэкслешами — нормализуем, чтобы отчёт был одинаков на всех ОС
const normalizePath = (p: string) => p.replace(/\\/g, '/')

export const parseLcov = (text: string): LcovRecord[] => {
  const records: LcovRecord[] = []
  let current = EMPTY()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === 'end_of_record') {
      if (current.file) records.push(current)
      current = EMPTY()
      continue
    }
    const sep = line.indexOf(':')
    if (sep === -1) continue
    const key = line.slice(0, sep)
    const value = line.slice(sep + 1)
    if (key === 'SF') current.file = normalizePath(value)
    else if (key === 'LF') current.linesFound = Number(value)
    else if (key === 'LH') current.linesHit = Number(value)
    else if (key === 'FNF') current.functionsFound = Number(value)
    else if (key === 'FNH') current.functionsHit = Number(value)
  }
  return records
}

export const summarize = (records: LcovRecord[]): CoverageSummary =>
  records.reduce(
    (acc, r) => ({
      files: acc.files + 1,
      linesFound: acc.linesFound + r.linesFound,
      linesHit: acc.linesHit + r.linesHit,
      functionsFound: acc.functionsFound + r.functionsFound,
      functionsHit: acc.functionsHit + r.functionsHit,
    }),
    { files: 0, linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 },
  )

// 0/0 — «нет данных», показываем «—», а не 100%
export const percent = (hit: number, found: number): string =>
  found === 0 ? '—' : `${((hit / found) * 100).toFixed(1)}%`

export const toMarkdown = (rows: Array<{ name: string; summary: CoverageSummary }>): string => {
  const header = [
    '| Workspace | Lines | Functions | Files |',
    '| --------- | ----- | --------- | ----- |',
  ]
  const body = rows.map(
    ({ name, summary: s }) =>
      `| ${name} | ${percent(s.linesHit, s.linesFound)} (${s.linesHit}/${s.linesFound}) | ${percent(s.functionsHit, s.functionsFound)} (${s.functionsHit}/${s.functionsFound}) | ${s.files} |`,
  )
  return [...header, ...body].join('\n')
}
