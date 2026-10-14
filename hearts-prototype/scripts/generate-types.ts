import { generateTypes } from 'payload/node'
import config from '../src/payload.config'

await generateTypes((await config) as never)
process.exit(0)
