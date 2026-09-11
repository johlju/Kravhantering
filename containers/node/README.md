# Shared UBI runtime packaging

`ubi-compat.sh` adapts the selected UBI Node.js minimal base for all six
published runtime images. Each Dockerfile invokes it during the existing image
build and declares its own workload packages, commands and final user.

The helper downloads the original
[Red Hat Universal Base Image EULA](https://www.redhat.com/licenses/EULA_Red_Hat_Universal_Base_Image_English_20190422.pdf)
and verifies the SHA-256 recorded in the helper before installing it at
`/usr/share/licenses/ubi/UBI-EULA.pdf`. The PDF remains unmodified; its contents
are not extracted into text or stored in Git. Uncached builds need HTTPS access
to that URL and fail if retrieval or checksum verification fails.

The project's original `LICENSE` stays in Git and is copied unchanged to
`/usr/share/licenses/kravhantering/LICENSE`. Both files are readable by the
supported runtime users. The helper leaves existing base-image license files
unchanged; dependency packaging follows the existing workload builds.

Final Dockerfiles identify the images as Viscalyx/Kravhantering, clear stale
base-image build metadata and retain component provenance. Using UBI does not
imply Red Hat endorsement, certification or support for Kravhantering.
