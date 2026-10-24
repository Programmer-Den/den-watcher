# Builds one image for the machine it is pulled on (arm64 for a Raspberry Pi,
# amd64 for a PC). The frontend and the Go binary are built on the build
# machine's own architecture and the binary is cross-compiled for the target,
# so building for a Pi never runs the Angular build on the Pi.

FROM --platform=$BUILDPLATFORM node:26-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Writes the website into /src/backend/internal/web/files/build.
RUN npm run build

FROM --platform=$BUILDPLATFORM golang:1.27-alpine AS backend
ARG TARGETOS
ARG TARGETARCH
# The version the program reports: 1.2.3 for a release, see the Docker image workflow.
ARG VERSION=dev
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=frontend /src/backend/internal/web/files/build ./internal/web/files/build
# The licenses of the Go code, served next to the website's 3rdpartylicenses.txt.
RUN go run ./cmd/licenses
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath \
      -ldflags="-s -w -X github.com/Programmer-Den/den-watcher/backend/internal/version.Version=$VERSION" \
      -o /out/den-watcher ./cmd/den-watcher
# The add-ons, each run as a container of its own when its profile in
# compose.yaml is picked: every command but den-watcher, the Windows tray
# and the add-ons without a container (gpu, inodes and smart, which come only
# with the Linux archive).
RUN mkdir /out/addons && for cmd in cmd/den-watcher-*/; do \
      name="$(basename "$cmd")"; \
      case "$name" in den-watcher-tray|den-watcher-gpu|den-watcher-inodes|den-watcher-smart) continue ;; esac; \
      CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
        go build -trimpath -ldflags="-s -w" -o "/out/addons/$name" "./$cmd" || exit 1; \
    done
# The names from before the rename to den-watcher, which compose.yaml files
# from then name as the add-ons' entrypoints: /usage-control-power and so on.
RUN cd /out/addons && ln -s den-watcher usage-control && for addon in den-watcher-*; do \
      ln -s "$addon" "usage-control-${addon#den-watcher-}" || exit 1; \
    done
# The folder the history database is kept in, mounted as a volume at run time.
RUN mkdir /out/data

# A minimal image without a shell or package manager, running as a non-root user.
FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=backend /out/den-watcher /out/addons/ /
# Owned by the nonroot user (65532), so a new volume mounted here is writable.
COPY --from=backend --chown=65532:65532 /out/data /data
# The file keeps its name from before the rename, so a volume from then keeps
# its history.
ENV DATABASE_PATH=/data/usage-control.db
# The folder SQLite sorts in when a sort outgrows its memory, such as for a
# long history range. compose.yaml makes the rest of the container read-only,
# where SQLite would find no folder it may write to and fail.
ENV SQLITE_TMPDIR=/data
VOLUME /data
EXPOSE 9393
ENTRYPOINT ["/den-watcher"]
