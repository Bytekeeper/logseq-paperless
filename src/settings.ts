import type { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin'
import { PaperlessApiError, reportApiError } from './lib/errors'

export const settingsSchema: SettingSchemaDesc[] = [
  {
    key: 'paperlessBaseUrl',
    type: 'string',
    default: '',
    title: 'Paperless-ngx Base URL',
    description: 'e.g. https://paperless.example.com (no trailing slash)',
  },
  {
    key: 'apiToken',
    type: 'string',
    default: '',
    title: 'API Token',
    description:
      "From paperless-ngx → My Profile → API Token. **Stored in plaintext** in Logseq's settings file — treat it like a password.",
  },
  {
    key: 'corsNotice',
    type: 'heading',
    default: null,
    title: 'Setup note',
    description:
      'Your paperless-ngx server must allow cross-origin requests from Logseq (PAPERLESS_CORS_ALLOWED_HOSTS). See the plugin README if links fail with a network/CORS error.',
  },
]

export interface PaperlessSettings {
  baseUrl: string
  token: string
}

export function getPaperlessSettings(): PaperlessSettings | null {
  const settings = logseq.settings as Record<string, unknown> | undefined
  const rawBaseUrl = typeof settings?.paperlessBaseUrl === 'string' ? settings.paperlessBaseUrl.trim() : ''
  const token = typeof settings?.apiToken === 'string' ? settings.apiToken.trim() : ''

  if (!rawBaseUrl || !token) {
    return null
  }

  return { baseUrl: rawBaseUrl.replace(/\/+$/, ''), token }
}

export function ensureConfigured(): PaperlessSettings | null {
  const settings = getPaperlessSettings()
  if (!settings) {
    reportApiError(new PaperlessApiError('missing-config'))
    return null
  }
  return settings
}
