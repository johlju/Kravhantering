# Shared UBI runtime packaging

`ubi-compat.sh` owns the filesystem adaptation used by all six published Node
runtime images. Each consumer mounts this directory during its build; workload
packages, commands and final users remain declared by that workload.

`UBI-EULA.pdf` is the unmodified
[Red Hat Universal Base Image EULA](https://www.redhat.com/licenses/EULA_Red_Hat_Universal_Base_Image_English_20190422.pdf),
retrieved on 2026-09-11. Its SHA-256 is
`a07025b9f5b71a816febe6ac76f21c9f759c806fa0a66874af90a50c3293f1b6`.
The helper installs it as `/usr/share/licenses/ubi/UBI-EULA.pdf`, readable by
all supported runtime users. It supplements the inherited component notices;
it does not replace their licenses or the project's MIT license. Keep this
vendor document unmodified when updating the shared packaging.

Builds use the committed document and need no documentation-site download.
Exact candidate verification compares the installed document's checksum with
this recorded upstream checksum. Using UBI does not imply Red Hat endorsement,
certification, or support for Kravhantering.
