import '@logseq/libs'
import './ui/picker.css'
import { settingsSchema } from './settings'
import { registerInsertSavedViewCommand } from './commands/insert-saved-view-link'
import { registerInsertDocumentLinkCommand } from './commands/insert-document-link'

function main() {
  logseq.useSettingsSchema(settingsSchema)
  registerInsertSavedViewCommand()
  registerInsertDocumentLinkCommand()
}

logseq.ready(main).catch(console.error)
