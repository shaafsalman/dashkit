import { MEDICAL_IMAGES } from "./manifest.js";

// One image from the 2D library. `theme` picks the dark version when there is one; without it, the page's prefers-color-scheme decides.
//
//   <MedicalImage name="lungs" base="/images" />
//   <MedicalImage name="bust" theme="dark" className="hero" />
export function MedicalImage({ name, base = "/images", theme, alt, className, style, loading = "lazy" }) {
  const image = MEDICAL_IMAGES[name];
  if (!image) return null;
  const common = { alt: alt ?? image.alt, width: image.width, height: image.height, className, style, loading, decoding: "async" };
  const light = `${base}/${image.light}`;
  if (!image.dark || theme === "light") return <img {...common} src={light} />;
  const dark = `${base}/${image.dark}`;
  if (theme === "dark") return <img {...common} src={dark} />;
  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={dark} />
      <img {...common} src={light} />
    </picture>
  );
}
