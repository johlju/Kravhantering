# Public SHA-1 rejection fixture

These certificates and the client key are deliberately public test material.
They identify no service and must never be used by a deployment. The CA signing
key is discarded. Tests evaluate the certificates at `2026-09-12T00:00:00Z`,
inside their seven-day validity window.

The client has the valid profile subject, RSA key size, leaf constraints, key
usage, and client EKU, but its CA signature uses SHA-1. This lets the validator
assert `SIGNATURE_ALGORITHM_INVALID` even on a runtime whose crypto policy
rejects creating new SHA-1 signatures. No runtime policy override is needed.

To replace this fixture, use an isolated test environment capable of signing
SHA-1 certificates: create a 4096-bit RSA CA with SHA-256 and a 2048-bit RSA
client CSR for `/CN=kravhantering-app`, then sign the CSR with
`openssl x509 -req -sha1`. Include critical `CA:FALSE` basic constraints, critical
`digitalSignature` key usage, and `clientAuth` EKU. Export the CA certificate,
client certificate, and public test client key; discard the CA key. Set the
explicit evaluation date in the test to fall within both validity windows.
