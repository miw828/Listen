import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

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

// https://vite.dev/config/
export default defineConfig({
  define: frontendEnvDefine,
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
