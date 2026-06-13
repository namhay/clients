/** Rasterize SVG to PNG for PDF embed (resvg works on Vercel; sharp is a local fallback). */
export async function rasterizeSvgToPng(svg: Buffer, width = 400): Promise<Buffer> {
  const svgText = svg.toString('utf8')

  try {
    const { Resvg } = await import('@resvg/resvg-js')
    const resvg = new Resvg(svgText, {
      fitTo: { mode: 'width', value: width },
    })
    return Buffer.from(resvg.render().asPng())
  } catch {
    const sharp = (await import('sharp')).default
    return sharp(svg, { density: 144 }).resize({ width, withoutEnlargement: true }).png().toBuffer()
  }
}
