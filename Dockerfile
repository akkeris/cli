FROM node:14-alpine
RUN apk add --no-cache git
WORKDIR /usr/src/app
COPY package*.json /usr/src/app/
RUN npm install --only=production
COPY . /usr/src/app/
ENTRYPOINT [ "node", "aka.js" ]