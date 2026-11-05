import { generateImportMap } from 'payload'
import config from '../src/payload.config'

await generateImportMap((await config) as never, { force: true } as never)
process.exit(0)
