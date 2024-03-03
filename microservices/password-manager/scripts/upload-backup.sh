#!/bin/bash

sudo_uninteractive() {
    echo "$PASSWORD" | sudo -S $@
}

docker_exec() {
    sudo_uninteractive docker exec $1 $2
}

MONGO_CONTAINER_IDS=$(echo "$PASSWORD" | sudo -S docker ps -q --filter "ancestor=mongo:bionic")
MONGO_CONTAINER_COUNTS=$(echo $MONGO_CONTAINER_IDS | wc -l)
if [ "$MONGO_CONTAINER_COUNTS" -eq "1" ]; then
    PIPE_COMM_DIR=$HOME/pipe-comm
    BACKUP_TARBALL_NAME=$1
    BACKUP_DIR_NAME=$2
    BACKUP_DIR_PATH=$PIPE_COMM_DIR/$BACKUP_DIR_NAME
    BACKUP_TARBALL_PATH=$PIPE_COMM_DIR/$BACKUP_TARBALL_NAME
    CHARSETS_DIR_PATH=$BACKUP_DIR_PATH/charsets
    MONGODUMP_DIR_PATH=$BACKUP_DIR_PATH/dump
    PRIMISTORE_DIR_PATH=$HOME/.primistore

    cd $HOME
    sudo_uninteractive tar -xvf $BACKUP_TARBALL_PATH
    sudo_uninteractive cp $CHARSETS_DIR_PATH/*.txt $PRIMISTORE_DIR_PATH 2>/dev/null
    
    MONGO_CONTAINER_ID=$(echo $MONGO_CONTAINER_IDS | head -n 1)
    sudo_uninteractive docker cp $MONGODUMP_DIR_PATH $MONGO_CONTAINER_ID:/ > /dev/null 2>&1
    docker_exec $MONGO_CONTAINER_ID "cd /; mongorestore"

    sudo_uninteractive rm -rf $BACKUP_DIR_PATH
else
    echo "More than one containers running MongoDB, please check your docker setup"
fi