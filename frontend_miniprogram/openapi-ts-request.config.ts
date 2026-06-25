import { defineConfig } from 'openapi-ts-request'

export default defineConfig([
  {
    describe: 'linkcloud-space-api',
    schemaPath: 'http://localhost:18000/api/openapi.json',
    serversPath: './src/services/openapi',
    requestLibPath: `import request from '@/http/vue-query';\n import { CustomRequestOptions_ } from '@/http/types';`,
    requestOptionsType: 'CustomRequestOptions_',
    isGenReactQuery: false,
    reactQueryMode: 'vue',
    isGenJavaScript: false,
  },
])
