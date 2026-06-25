FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHON_BIN=python3
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libgl1 \
    libopenal1 \
    libx11-6 \
    libxext6 \
    libxrender1 \
    libxtst6 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY requirements.txt ./
RUN npm ci
RUN python3 -m venv /opt/venv
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN python scripts/fetch_vizdoom_assets.py

EXPOSE 8080
CMD ["npm", "start"]
