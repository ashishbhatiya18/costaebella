# Cross-compile natively on the build host (BUILDPLATFORM) for whatever
# TARGETPLATFORM buildx is producing (e.g. linux/arm64 for Raspberry Pi 4/5).
# This avoids running `go build` under QEMU emulation, which is slow and can
# be flaky — only the tiny final stage below needs to run under emulation.
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .

ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# distroless/static: no shell, no package manager, just CA certs + tzdata +
# the statically-linked binary above. Non-root by default (nonroot user).
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /usr/local/bin/api
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/api"]
