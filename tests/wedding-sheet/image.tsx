import type { ImgHTMLAttributes } from "react";

export default function TestImage({ fill, priority: _priority, unoptimized: _unoptimized, style, ...props }:
  ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) {
  return <img {...props} style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style} />;
}
