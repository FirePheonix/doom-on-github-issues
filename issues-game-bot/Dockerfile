FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHON_BIN=python3
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    git \
    make \
    gcc \
    libc6-dev \
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
RUN python scripts/fetch_doom_assets.py
RUN git clone --depth=1 https://github.com/ozkl/doomgeneric /tmp/doomgeneric \
    && cp /app/scripts/doomgeneric_issuebot.c /tmp/doomgeneric/doomgeneric/doomgeneric_issuebot.c \
    && cp /app/scripts/doomgeneric_session_worker.c /tmp/doomgeneric/doomgeneric/doomgeneric_session_worker.c \
    && cp /app/scripts/Makefile.issuebot /tmp/doomgeneric/doomgeneric/Makefile.issuebot \
    && make -C /tmp/doomgeneric/doomgeneric -f Makefile.issuebot \
    && mkdir -p /app/scripts/assets \
    && cp /tmp/doomgeneric/doomgeneric/doomgeneric_issuebot /app/scripts/assets/doomgeneric_issuebot \
    && cp /tmp/doomgeneric/doomgeneric/doomgeneric_session_worker /app/scripts/assets/doomgeneric_session_worker \
    && rm -rf /tmp/doomgeneric

EXPOSE 8080
CMD ["npm", "start"]
