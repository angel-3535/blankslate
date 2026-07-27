import { defineConfig } from 'nitro'

export default defineConfig({
  features: {
    websocket: true,
  },
  serverDir: './server',
  vercel: {
    functionRules: {
      '/ws': {
        maxDuration: 300,
      },
    },
  },
})
