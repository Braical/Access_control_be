FROM node:18.18-alpine3.18 

WORKDIR /app
COPY . .

EXPOSE 3888

RUN npm install

# tzdata for timzone
RUN apk add --no-cache tzdata
 
# timezone env with default
ENV TZ=America/Argentina/Buenos_Aires

CMD ["node", "/app/index.js"]
