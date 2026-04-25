import { parseDocx } from './docxParser'
import { parsePdf } from './pdfParser'

export type SupportedFileType = 'txt' | 'md' | 'docx' | 'pdf' | 'unknown'

export function getFileType(file: File): SupportedFileType {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt')) return 'txt'
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'md'
  if (name.endsWith('.docx')) return 'docx'
  if (name.endsWith('.pdf')) return 'pdf'
  return 'unknown'
}

export async function parseFile(file: File): Promise<string> {
  const type = getFileType(file)

  switch (type) {
    case 'txt':
    case 'md': {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
        reader.readAsText(file, 'UTF-8')
      })
    }
    case 'docx':
      return parseDocx(file)
    case 'pdf':
      return parsePdf(file)
    default:
      throw new Error(`Unsupported file type: ${file.name}. Supported: .txt .md .docx .pdf`)
  }
}
