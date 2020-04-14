FROM node:12
WORKDIR /usr/app

RUN apt-get update
RUN apt-get install libaio1

COPY package.json package-lock.json ./
RUN npm install --verbose

ENV LD_LIBRARY_PATH=/lib
RUN wget https://download.oracle.com/otn_software/linux/instantclient/193000/instantclient-basic-linux.x64-19.3.0.0.0dbru.zip && \
    unzip instantclient-basic-linux.x64-19.3.0.0.0dbru.zip && \
    cp -r instantclient_19_3/* /lib && \
    rm -rf instantclient-basic-linux.x64-19.3.0.0.0dbru.zip

EXPOSE 5080
EXPOSE 5081

CMD ["tail", "-f", "/dev/null"]