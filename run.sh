#!/bin/bash

# Function to install Docker
install_docker() {
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    sudo usermod -aG docker $USER
    newgrp docker
}

# Function to install Docker Compose
install_docker_compose() {
    echo "Installing Docker Compose..."
    DOCKER_COMPOSE_VERSION="1.29.2"
    sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
}

# Check if docker is available
if ! command -v docker &> /dev/null; then
    install_docker
fi

# Check if docker-compose or docker compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
    install_docker_compose
fi

# Use docker compose if available, otherwise fallback to docker-compose
if command -v docker compose &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

echo "Starting Docker Compose build and run..."
$COMPOSE_CMD up --build
