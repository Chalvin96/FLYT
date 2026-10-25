import { fileURLToPath } from "node:url";
import sharp from "sharp";

const source = fileURLToPath(
  new URL("../assets/flytlese-mark.svg", import.meta.url),
);
for (const size of [16, 32, 48, 128]) {
  const target = fileURLToPath(
    new URL(`../public/icons/icon-${size}.png`, import.meta.url),
  );
  await sharp(source, { density: 384 }).resize(size, size).png().toFile(target);
}
