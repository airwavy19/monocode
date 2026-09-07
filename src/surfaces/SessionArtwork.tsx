import { DEFAULT_ARTWORK, localArtworkUrl } from "../lib/sessionArtwork";
import { useEffect, useRef, type CSSProperties } from "react";
import type { SessionArtwork as Artwork } from "../lib/sessionArtwork";
import "./SessionArtwork.css";

export function SessionArtwork({ artwork }: { artwork: Artwork }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let disposed = false;
    const image = new Image();
    const draw = () => {
      if (disposed || !image.naturalWidth) return;
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      if (artwork.pixelated) {
        canvas.width = Math.ceil(width / artwork.pixelSize);
        canvas.height = Math.ceil(height / artwork.pixelSize);
        const scale = Math.max(
          canvas.width / image.width,
          canvas.height / image.height,
        );
        const w = image.width * scale;
        const h = image.height * scale;
        context.drawImage(
          image,
          (canvas.width - w) / 2,
          (canvas.height - h) * 0.3,
          w,
          h,
        );
        // Ordered color dithering produces the fine woven pixel texture in the reference.
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const offset = (y * canvas.width + x) * 4;
            const threshold = (bayer[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * 42;
            for (let c = 0; c < 3; c++) {
              pixels.data[offset + c] =
                Math.round((pixels.data[offset + c] + threshold) / 32) * 32;
            }
          }
        }
        context.putImageData(pixels, 0, 0);
      } else {
        // Native definition: paint at container resolution with smooth scaling.
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        const scale = Math.max(
          canvas.width / image.width,
          canvas.height / image.height,
        );
        const w = image.width * scale;
        const h = image.height * scale;
        context.drawImage(
          image,
          (canvas.width - w) / 2,
          (canvas.height - h) * 0.3,
          w,
          h,
        );
      }
    };
    image.onload = draw;
    let objectUrl: string | undefined;
    image.onerror = () => {
      if (!disposed && image.getAttribute("src") !== DEFAULT_ARTWORK.source)
        image.src = DEFAULT_ARTWORK.source;
    };
    if (artwork.path) {
      void localArtworkUrl(artwork.path)
        .then((url) => {
          if (disposed) {
            URL.revokeObjectURL(url);
            return;
          }
          objectUrl = url;
          image.src = url;
        })
        .catch(() => {
          if (!disposed) image.src = DEFAULT_ARTWORK.source;
        });
    } else image.src = artwork.source;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => {
      disposed = true;
      observer.disconnect();
      image.onload = null;
      image.onerror = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [artwork.source, artwork.path, artwork.pixelSize, artwork.pixelated]);
  return (
    <div
      className="session-artwork"
      aria-hidden="true"
      style={
        { "--artwork-brightness": artwork.brightness / 100 } as CSSProperties
      }
    >
      <canvas
        ref={ref}
        style={{ imageRendering: artwork.pixelated ? "pixelated" : "auto" }}
      />
    </div>
  );
}
