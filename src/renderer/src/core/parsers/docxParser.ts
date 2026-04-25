// Parse .docx files using mammoth
// mammoth is loaded dynamically to avoid issues with SSR/preload contexts

export async function parseDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  if (result.messages.length > 0) {
    const errors = result.messages.filter((m) => m.type === 'error')
    if (errors.length > 0) {
      throw new Error(`DOCX parse error: ${errors[0].message}`)
    }
  }
  return result.value
}
