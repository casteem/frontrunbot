FROM node:10-alpine

ARG SOURCE_COMMIT
ENV SOURCE_COMMIT ${SOURCE_COMMIT}
ARG DOCKER_TAG
ENV DOCKER_TAG ${DOCKER_TAG}

ENV NPM_CONFIG_LOGLEVEL warn

RUN apk add --no-cache git nano

RUN npm config set unsafe-perm true
RUN npm i npm@latest -g

WORKDIR /var/app
RUN mkdir -p /var/app


COPY package.json /var/app/
RUN npm install --save

COPY . /var/app

ENV PORT 3000

EXPOSE 3000

#ENTRYPOINT ["echo","node get-claimed-rewards.js username"]
#CMD ["/bin/sh"]

CMD [ "node", "frontrun.js" ]
