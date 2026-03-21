# use node 20 alpine image
FROM node:20-alpine

# create destination directory
RUN mkdir -p /usr/src/nuxt-app
WORKDIR /usr/src/nuxt-app

# copy package.json and package-lock.json
COPY package*.json ./

# install dependencies
RUN npm install

# copy project files
COPY . .

# build the project
RUN npm run build

# expose port 3000
EXPOSE 3000

# set environment variables
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

# start the app
CMD [ "node", ".output/server/index.mjs" ]
