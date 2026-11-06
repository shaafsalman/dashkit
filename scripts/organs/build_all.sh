#!/bin/sh
# Builds every organ, or the ones named: scripts/organs/build_all.sh <folder of .glb sources> [heart lungs ...]
src="$1"; shift
set -- ${@:-heart lungs liver kidney brain}
for organ in "$@"; do
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/organs/build.py -- --organ "$organ" --src "$src" --out assets/organs --poster-size 1024 --samples 96 2>&1 | grep -E --line-buffered "GROW|BUILT|BAKED|DONE|Traceback|Error|no mark|no meshes"
  [ -f "assets/organs/$organ/model.raw.glb" ] && sh scripts/organs/compress.sh "assets/organs/$organ" | grep -E "model.glb"
done
echo ALLDONE
