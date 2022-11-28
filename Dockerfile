FROM node:16.8-alpine
RUN apk update \
    && apk --no-cache --update add build-base
