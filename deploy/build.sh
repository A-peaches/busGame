#!/bin/sh
# 게임에 필요한 파일만 dist 로 모아요 (server 폴더 등은 빼요)
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist/.well-known
cp -r ../index.html ../css ../js ../icons ../icon.png ../manifest.webmanifest ../sw.js dist/
cp assetlinks.json dist/.well-known/assetlinks.json
echo "dist ready"
