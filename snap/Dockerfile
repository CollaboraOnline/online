FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV LC_ALL=C.UTF-8

RUN apt-get update && \
    apt-get install -y \
        systemd snapd squashfuse fuse3 \
        git rsync ca-certificates sudo \
        # Qt6 dev packages (replace kde-qt6-core24-sdk build-snap)
        qt6-webengine-dev qt6-base-dev qt6-declarative-dev \
        qt6-tools-dev qt6-tools-dev-tools \
    && apt-get clean

# Trim systemd services that are unnecessary / break in a container
RUN find /etc/systemd/system /lib/systemd/system \
        -path '*.wants/*' \
        ! -name 'snapd.*' \
        ! -name 'systemd-tmpfiles*' \
        ! -name 'systemd-journald*' \
        -delete 2>/dev/null; true

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
