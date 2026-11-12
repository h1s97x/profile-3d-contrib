# CNB 插件镜像 / GitHub container action 共用镜像。
#
# 一律从源码构建:GitHub 通过 action.yml 的 image: 'Dockerfile' 现场构建,
# CNB 通过 .cnb.yml 预构建并推送到制品库。仓库不再提交 dist/。
FROM node:24-alpine AS builder

WORKDIR /build
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm ci --no-audit --no-fund \
    && npm run build \
    && test -s dist/index.js

FROM node:24-alpine

# CNB 会把构建工作区挂载到插件容器内的同一路径并设为工作目录；
# 生成器把 SVG 写到 ./profile-3d-contrib/，因此工作目录必须是该工作区。
# 本地 `docker run` 时 /workspace 也提供一个可写目录。
WORKDIR /workspace

COPY --from=builder /build/dist /app/dist
COPY docker/entrypoint.js /app/entrypoint.js

ENTRYPOINT ["node", "/app/entrypoint.js"]
