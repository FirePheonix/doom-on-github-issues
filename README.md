<div align="center">

<img src="https://github.com/user-attachments/assets/08132b48-4d0e-406a-8f95-1a85c1329ce4" width="180" alt="doom-icon"/>

# 🎮 doom-on-github-issues
![GitHub stars](https://img.shields.io/github/stars/FirePheonix/doom-on-github-issues?style=flat-square)
![GitHub forks](https://img.shields.io/github/forks/FirePheonix/doom-on-github-issues?style=flat-square)
![GitHub issues](https://img.shields.io/github/issues/FirePheonix/doom-on-github-issues?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/FirePheonix/doom-on-github-issues?style=flat-square)
<p>
  <strong>Play Doom using nothing but GitHub Issues.</strong><br/>
  One issue = one game session · One comment = one game tick
</p>

<img src="https://github.com/user-attachments/assets/c4dfc84c-7a8a-4798-9b5c-087719144b7e" width="520" alt="doom-gif"/>

<br/>

![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![C](https://img.shields.io/badge/C-A8B9CC?style=for-the-badge&logo=c&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![MIT License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

</div>

---

## 🚀 Overview

The active implementation lives in **`issues-game-bot/`**.


<p align="center">
  <img src="https://github.com/user-attachments/assets/b8ea8409-ce78-4814-9721-439e4e0f4e6f" width="700"/>
</p>

This repository is an open-source experiment that turns **GitHub Issues into a multiplayer Doom interface**.

Each GitHub Issue represents a persistent game session:

- 🎮 **1 Issue = 1 Doom Session**
- 💬 **1 Comment = 1 Action Tick**
- 🖼️ **Issue Body = Live Rendered Frame**

---

## 🏗️ Architecture (V4)

<p align="center">
  <img src="https://github.com/user-attachments/assets/ba6401dc-167c-4dd8-bc08-6ff1cc3fe8b1" width="1000"/>
</p>

---

## 📂 Repository Structure

```text
issues-game-bot/      → Main game implementation
documentation/        → Architecture & release documentation
```

---

## 🤝 Contributing

See **`CONTRIBUTING.md`** for:

- Local setup
- Development workflow
- Contribution guidelines
- Required checks

---

## 📦 Current Release

**v4.0.0**

> **Persistence & Latency Release**

Version 4 introduces:

- ⚡ Persistent DoomGeneric worker
- 🖼️ Cached startup & menu frames
- ☁️ Deterministic S3 frame delivery
- 📥 Batched GitHub comment commands
- 🎮 GitHub Issues remain the only game interface

For the full breakdown, see:

- `CHANGELOG.md`
- `documentation/v4-release-notes/`
