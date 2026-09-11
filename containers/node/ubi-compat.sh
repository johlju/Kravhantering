#!/bin/sh
# Shared filesystem adaptation for the selected UBI Node.js minimal runtime.
# Consumers declare their own packages, environment, entrypoint and final user.
set -eu

[ "$(id -u)" = 0 ]
[ "$(node -p 'process.versions.node.split(".")[0]')" = 24 ]
# Fail closed if a replacement base assigns the supported identity elsewhere.
if getent passwd node >/dev/null || getent passwd 1000 >/dev/null \
  || getent group node >/dev/null || getent group 1000 >/dev/null; then
  echo 'UBI compatibility: node identity is already allocated.' >&2
  exit 1
fi
printf '%s\n' 'node:x:1000:' >> /etc/group
printf '%s\n' 'node:x:1000:1000:Node.js:/home/node:/bin/bash' >> /etc/passwd
mkdir -p /home/node
chown 1000:1000 /home/node
chmod 0755 /home/node

# Fetch original vendor notices at build time; install only verified bytes.
notices=$(node -e '
  const fs = require("node:fs");
  const lock = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  for (const { url, sha256, installedPath } of [lock.ubi, lock["nodejs-nodemon"]]) {
    console.log([url, sha256, installedPath].join("\t"));
  }
' "$(dirname "$0")/runtime-notices.lock.json")
printf '%s\n' "$notices" | while IFS="$(printf '\t')" read -r url checksum target; do
  notice_file=$(mktemp)
  trap 'rm -f "$notice_file"' 0 HUP INT TERM
  curl --fail --silent --show-error --location --retry 3 \
    --proto '=https' --proto-redir '=https' --output "$notice_file" "$url"
  if ! printf '%s  %s\n' "$checksum" "$notice_file" | sha256sum --check --status; then
    echo "UBI compatibility: notice checksum mismatch for $target." >&2
    exit 1
  fi
  mkdir -p "$(dirname "$target")"
  cp "$notice_file" "$target"
  chmod 0644 "$target"
  rm -f "$notice_file"
done
mkdir -p /usr/share/licenses/kravhantering
cp /tmp/kravhantering-LICENSE /usr/share/licenses/kravhantering/LICENSE
chmod 0644 /usr/share/licenses/kravhantering/LICENSE

# Production cleanup jobs use this absolute executable path.
mkdir -p /usr/local/bin
ln -s /usr/bin/node /usr/local/bin/node

# Keep workload dependencies and inherited nodemon; remove the npm CLI payload.
rm -rf /usr/lib/node_modules_24/npm
rm -f /usr/bin/npm /usr/bin/npx /usr/bin/npm-24 /usr/bin/npx-24
