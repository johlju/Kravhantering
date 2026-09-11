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

# Production cleanup jobs use this absolute executable path.
mkdir -p /usr/local/bin
ln -s /usr/bin/node /usr/local/bin/node

# Keep workload dependencies and inherited nodemon; remove the npm CLI payload.
rm -rf /usr/lib/node_modules_24/npm
rm -f /usr/bin/npm /usr/bin/npx /usr/bin/npm-24 /usr/bin/npx-24
