export class RecursiveCharacterTextSplitter {
  chunkSize: number;
  chunkOverlap: number;

  constructor({ chunkSize = 1000, chunkOverlap = 200 } = {}) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  splitText(text: string): string[] {
    if (!text) return [];
    
    // Simple implementation: split by generic separators if possible, or just character limit
    // For this demo, we'll do a simple slice-based approach but respecting words if possible.
    // A more robust implementation involves checking "\\n\\n", "\\n", " ", "" priority.

    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      // Calculate end position
      let end = start + this.chunkSize;
      
      if (end >= text.length) {
        chunks.push(text.slice(start));
        break;
      }

      // Try to find a nice break point (space) backwards from end
      let splitPoint = text.lastIndexOf(" ", end);
      
      // If no space found within a reasonable distance (e.g. 10% back), just hard cut
      if (splitPoint < start || splitPoint < end - (this.chunkSize * 0.2)) {
        splitPoint = end;
      }

      chunks.push(text.slice(start, splitPoint));
      
      // Move start forward, accounting for overlap
      start = splitPoint - this.chunkOverlap;
      // Ensure we always move forward
      if (start <= chunks[chunks.length - 1].length && start <= splitPoint - this.chunkSize) {
         start = splitPoint; // Fallback to avoid infinite loop if overlap is weird
      }
      // Actually simpler: just set start to splitPoint - overlap, but make sure start > previous start
      // To keep it simple and safe:
      start = Math.max(start, 0); 
      
      // Correction for loop safety (advance at least 1 char effectively)
      // Actually standard logic: new start = current end - overlap.
      // If we used `splitPoint` as the cut, that's the end of current chunk.
      start = splitPoint - this.chunkOverlap; 
    }

    return chunks;
  }
}
