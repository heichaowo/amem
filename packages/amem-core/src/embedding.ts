/**
 * embedding.ts — Local ONNX embedding via @huggingface/transformers
 * Model: Xenova/paraphrase-multilingual-MiniLM-L12-v2 (384-dim)
 * Matches Python: SentenceTransformer.encode(text, normalize_embeddings=True)
 */

// Dynamic import to avoid issues with CJS bundling
let pipeline: any = null
let extractor: any = null

const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'

async function getExtractor() {
  if (extractor) return extractor
  if (!pipeline) {
    const mod = await import('@huggingface/transformers')
    pipeline = mod.pipeline
  }
  extractor = await pipeline('feature-extraction', MODEL_NAME, {
    revision: 'main',
  })
  return extractor
}

/**
 * Mean pooling over token embeddings, then L2 normalize.
 * Matches sentence-transformers encode(normalize_embeddings=True).
 */
function meanPoolingNormalize(output: number[][], attentionMask: number[]): number[] {
  const seqLen = output.length
  const dim = output[0].length

  // Mean pool with attention mask
  const pooled = new Array(dim).fill(0)
  let maskSum = 0
  for (let i = 0; i < seqLen; i++) {
    const m = attentionMask[i]
    maskSum += m
    for (let j = 0; j < dim; j++) {
      pooled[j] += output[i][j] * m
    }
  }
  for (let j = 0; j < dim; j++) {
    pooled[j] /= Math.max(maskSum, 1e-9)
  }

  // L2 normalize
  let norm = 0
  for (const v of pooled) norm += v * v
  norm = Math.sqrt(norm)
  return pooled.map((v) => v / Math.max(norm, 1e-9))
}

/**
 * Encode text to 384-dim normalized embedding vector.
 * Singleton model, loaded once and reused.
 */
export async function encode(text: string): Promise<number[]> {
  const ext = await getExtractor()
  const result = await ext(text, { pooling: 'mean', normalize: true })

  // result.data is a Float32Array of shape [dim]
  // @huggingface/transformers v3 returns already pooled+normalized when pooling+normalize options given
  if (result && result.data) {
    return Array.from(result.data as Float32Array)
  }

  // Fallback: manual mean pool if result is nested
  const tensor = result as any
  if (tensor.dims && tensor.dims.length === 3) {
    // shape: [1, seq_len, dim]
    const seqLen = tensor.dims[1]
    const dim = tensor.dims[2]
    const raw: number[][] = []
    for (let i = 0; i < seqLen; i++) {
      const row: number[] = []
      for (let j = 0; j < dim; j++) {
        row.push(tensor.data[i * dim + j])
      }
      raw.push(row)
    }
    return meanPoolingNormalize(raw, new Array(seqLen).fill(1))
  }

  throw new Error('Unexpected embedding output shape')
}

/**
 * Cosine similarity between two normalized vectors (already L2-normalized → just dot product)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}
