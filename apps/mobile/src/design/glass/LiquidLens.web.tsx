import { useEffect, useId, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useAppearance } from '../appearance.ts';
import type { LensProps } from './LiquidLens.tsx';

let displacementMap: string | undefined;

function makeDisplacementMap() {
  if (displacementMap) return displacementMap;
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 72;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  const pixels = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const dx = 2 * x / (canvas.width - 1) - 1;
      const dy = 2 * y / (canvas.height - 1) - 1;
      const rim = Math.min(1, Math.hypot(dx, dy)) ** 4;
      const offset = (y * canvas.width + x) * 4;
      pixels.data[offset] = 128 - dx * rim * 108;
      pixels.data[offset + 1] = 128 - dy * rim * 108;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  displacementMap = canvas.toDataURL();
  return displacementMap;
}

export function LiquidLens({ height, style }: LensProps) {
  const { palette, reduceTransparency } = useAppearance();
  const id = 'jhs-lens-' + useId().replace(/[^a-z0-9-]/gi, '');
  const [map, setMap] = useState<string>();
  useEffect(() => {
    if (!reduceTransparency && CSS.supports('backdrop-filter', `url(#${id})`)) setMap(makeDisplacementMap());
  }, [id, reduceTransparency]);
  return <View pointerEvents="none" style={[style, {
    borderRadius: height / 2, backgroundColor: reduceTransparency ? palette.surfaceElevated : palette.glassLensTint,
    backdropFilter: reduceTransparency ? 'none' : map ? `url(#${id}) blur(5px) saturate(150%)` : 'blur(5px) saturate(150%)',
    borderWidth: 1, borderColor: palette.glassRim, boxShadow: 'inset 0 -1px 0 ' + palette.hairline,
  } as ViewStyle]}>
    {map && !reduceTransparency && <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs><filter id={id} primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
        <feImage href={map} preserveAspectRatio="none" result="displacement" />
        <feDisplacementMap in="SourceGraphic" in2="displacement" scale=".15" xChannelSelector="R" yChannelSelector="G" />
      </filter></defs>
    </svg>}
  </View>;
}
