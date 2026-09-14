// A smooth projection, not a species identifier: nearby colors can be unrelated.
// Keep this mapping stable so archived and replanted genomes retain their color.
export function genomePalette(dna) {
  let hue = 135, index = 0;
  for (const row of dna) for (const value of row) {
    const weight = 0.6 + ((index++ * 17) % 23) / 55;
    hue += (value / 31 - 0.5) * 18 * weight;
  }
  hue = ((hue % 360) + 360) % 360;
  const color = (saturation, lightness) => `hsl(${hue.toFixed(2)}, ${saturation}%, ${lightness}%)`;
  return { hue, leaf: color(43, 61), wood: color(23, 39),
    sprout: color(48, 79), ready: color(58, 72), seed: color(58, 72) };
}
