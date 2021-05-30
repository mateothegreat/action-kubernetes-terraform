FROM node:alpine

RUN apk add --update wget jq unzip curl

RUN curl -LO "https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl"
RUN mv kubectl /bin/kubectl && chmod +x /bin/kubectl

RUN wget "https://releases.hashicorp.com/terraform/0.14.8/terraform_0.14.8_linux_amd64.zip" && \
    unzip "./terraform_0.14.8_linux_amd64.zip" -d /usr/local/bin

COPY src .
COPY package.json .

RUN npm run build

ENTRYPOINT ["node", "dist/main.js"]
