FROM node:20-alpine
WORKDIR /app

# 仓库中无 package-lock.json，使用 npm install 安装生产依赖
COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["npm", "start"]
