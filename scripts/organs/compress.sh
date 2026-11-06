#!/bin/sh
# Compresses a built organ's model for the web with meshopt, which three's MeshoptDecoder reads with no extra files to host.
# Usage: scripts/organs/compress.sh assets/organs/heart
set -e
npx -y @gltf-transform/cli@4 meshopt "$1/model.raw.glb" "$1/model.glb" --level high
rm "$1/model.raw.glb"
ls -la "$1"
