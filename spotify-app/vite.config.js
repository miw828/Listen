import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { reactCompilerPreset } from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

function readFrontendEnv() {
  const envPath = resolve(process.cwd(), 'frontend.env')
  if (!existsSync(envPath)) return {}

  return readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
        return values
      }
      const [key, ...rest] = trimmed.split('=')
      values[key] = rest.join('=').trim()
      return values
    }, {})
}

const frontendEnv = readFrontendEnv()
const frontendEnvDefine = Object.fromEntries(
  Object.entries(frontendEnv).map(([key, value]) => [
    `import.meta.env.${key}`,
    JSON.stringify(value),
  ]),
)

export default defineConfig({
  define: frontendEnvDefine,
  plugins: [
    react(),
    basicSsl(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    https: true
  }
})