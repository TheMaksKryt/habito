// Сгенерированный SDK (hey-api 0.99.0, client-nuxt) не проходит строгий tsc
// на TS 6.x — ошибки внутри client.gen/sdk.gen, править их вручную нельзя
// (код перегенерируется). По конституции сгенерированный код исключён из
// проверок, поэтому после генерации добавляем @ts-nocheck: ошибки внутри
// файлов подавляются, а экспортируемые типы продолжают типизировать
// вызывающий код. Убрать, когда hey-api станет совместим с текущим TS.
import { Glob } from 'bun'

const glob = new Glob('generated/api/**/*.ts')
let patched = 0

for await (const path of glob.scan('.')) {
  const text = await Bun.file(path).text()
  if (!text.startsWith('// @ts-nocheck')) {
    await Bun.write(path, `// @ts-nocheck\n${text}`)
    patched += 1
  }
}

console.log(`patched ${patched} generated SDK files with @ts-nocheck`)
