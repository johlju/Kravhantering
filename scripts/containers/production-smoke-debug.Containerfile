FROM ubuntu:24.04@sha256:561618e2c15bf2397621dd04f96926663a3b5616c189cf7e38db7e82f5c538ea

ENV container=docker

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends \
      aardvark-dns \
      ca-certificates \
      curl \
      dbus-user-session \
      fuse-overlayfs \
      iptables \
      jq \
      libnss3-tools \
      netavark \
      podman \
      slirp4netns \
      sudo \
      systemd \
      systemd-sysv \
      uidmap && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

STOPSIGNAL SIGRTMIN+3

CMD ["/sbin/init"]
