/** Rasterize SVG to PNG (resvg works on Vercel; sharp is a local fallback). */
export async function rasterizeSvgToPng(svg: Buffer): Promise<Buffer> {
  const svgText = svg.toString('utf8')

  try {
    const { Resvg } = await import('@resvg/resvg-js')
    const resvg = new Resvg(svgText, {
      fitTo: { mode: 'width', value: 1200 },
    })
    return Buffer.from(resvg.render().asPng())
  } catch {
    const sharp = (await import('sharp')).default
    return sharp(svg, { density: 200 }).png().toBuffer()
  }
}
