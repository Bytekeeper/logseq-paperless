export function escapeMarkdownLinkText(text: string): string {
  return text.replace(/[[\]]/g, (match) => `\\${match}`)
}

export function buildMarkdownLink(label: string, url: string): string {
  return `[${escapeMarkdownLinkText(label)}](${url})`
}
