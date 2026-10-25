#!/usr/bin/env bash
set -euo pipefail
revision=bda3a363e9695e3f63fce4a7ca85ba17b5fecb61
checkout=$(mktemp -d)
trap 'rm -rf "$checkout"' EXIT
git -C "$checkout" init
git -C "$checkout" remote add origin https://github.com/NousResearch/hermes-agent.git
git -C "$checkout" fetch --depth=1 origin "$revision"
git -C "$checkout" checkout --detach FETCH_HEAD
docker build -t curdr-hermes-upstream:bda3a363e969 "$checkout"
